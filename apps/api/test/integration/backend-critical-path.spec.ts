import argon2 from 'argon2';
import { Queue } from 'bullmq';
import type Redis from 'ioredis';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type {
  AppRole,
  AuthUserResponse,
  DashboardSummary,
  IamPermissionItem,
  IamRoleItem,
  IamUserDetail,
  IamUserListItem,
  PaginatedResponse,
  PedagogicalCompany,
  PedagogicalSyncJobPayload,
  PedagogicalStudent,
  SessionItem,
  SyncIssueStateItem,
  SyncOverview,
} from '@financial-martec/contracts';
import {
  PEDAGOGICAL_SYNC_JOB_OPTIONS,
  PEDAGOGICAL_SYNC_QUEUE,
  permissions,
  rolePermissions,
  roles,
} from '@financial-martec/contracts';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { configureApp } from '@/app.setup';
import { PrismaService } from '@/common/prisma/prisma.service';
import { RedisService } from '@/common/redis/redis.service';

const OWNER_PASSWORD = 'CurrentPass123!';
const NEW_OWNER_PASSWORD = 'NewPass456!';

jest.setTimeout(30_000);

type HttpServer = Parameters<typeof request>[0];
type LoginResponseBody = {
  user: AuthUserResponse;
};

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  });
}

function buildCompany(sourceId = 'company-1'): PedagogicalCompany {
  return {
    id: sourceId,
    nome: 'Empresa 1',
    criado_em: '2026-03-18T08:00:00.000Z',
    razao_social: 'Empresa 1 LTDA',
    cnpj: '12345678000190',
    telefone: '11999999999',
    email: 'empresa1@pedagogico.test',
  };
}

function buildStudent(sourceId = 'student-1', companySourceId = 'company-1'): PedagogicalStudent {
  return {
    id: sourceId,
    nome: 'Aluno 1',
    cpf: '12345678901',
    data_nascimento: '2005-03-18T00:00:00.000Z',
    empresa_id: companySourceId,
    criado_em: '2026-03-18T08:05:00.000Z',
    atualizado_em: '2026-03-18T08:10:00.000Z',
    email: 'aluno1@pedagogico.test',
  };
}

describe('Backend critical path integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: Redis;
  let queue: Queue<PedagogicalSyncJobPayload>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = moduleRef.get(PrismaService);
    redis = moduleRef.get(RedisService).getClient();
    queue = new Queue<PedagogicalSyncJobPayload>(PEDAGOGICAL_SYNC_QUEUE, {
      connection: redis,
    });
    await queue.waitUntilReady();

    await ensureRbacSeed(prisma);
  });

  beforeEach(async () => {
    jest.restoreAllMocks();
    await redis.flushdb();
    await resetDatabase(prisma);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await queue.close();
    await app.close();
  });

  it('covers auth session lifecycle including refresh, revoke and change password', async () => {
    await createUserWithRole(prisma, 'owner-auth@integration.test', OWNER_PASSWORD, 'owner');

    const primaryAgent = request.agent(getHttpServer(app));
    const secondaryAgent = request.agent(getHttpServer(app));

    const loginResponse = await login(primaryAgent, 'owner-auth@integration.test', OWNER_PASSWORD);
    const loginBody = readBody<LoginResponseBody>(loginResponse);
    expect(loginBody.user.permissions).toContain('sync.manage');

    await primaryAgent.post('/v1/auth/refresh').expect(200);
    await login(secondaryAgent, 'owner-auth@integration.test', OWNER_PASSWORD);

    const sessionsResponse = await primaryAgent.get('/v1/auth/sessions').expect(200);
    const sessions = readBody<SessionItem[]>(sessionsResponse);
    expect(sessions).toHaveLength(2);

    const secondarySession = sessions.find((session) => !session.current);
    expect(secondarySession?.id).toBeTruthy();
    if (!secondarySession) {
      throw new Error('Expected a secondary session to revoke.');
    }

    await primaryAgent.delete(`/v1/auth/sessions/${secondarySession.id}`).expect(200);
    await secondaryAgent.get('/v1/auth/me').expect(401);

    const thirdAgent = request.agent(getHttpServer(app));
    await login(thirdAgent, 'owner-auth@integration.test', OWNER_PASSWORD);

    await primaryAgent
      .post('/v1/auth/change-password')
      .send({
        currentPassword: OWNER_PASSWORD,
        newPassword: NEW_OWNER_PASSWORD,
      })
      .expect(200);

    await thirdAgent.get('/v1/auth/me').expect(401);
    await request(getHttpServer(app))
      .post('/v1/auth/login')
      .send({
        email: 'owner-auth@integration.test',
        password: OWNER_PASSWORD,
      })
      .expect(401);

    await request(getHttpServer(app))
      .post('/v1/auth/login')
      .send({
        email: 'owner-auth@integration.test',
        password: NEW_OWNER_PASSWORD,
      })
      .expect(200);

    await primaryAgent.post('/v1/auth/logout').expect(200);
    await primaryAgent.get('/v1/auth/me').expect(401);
  });

  it('persists failed sync runs as failures and enqueues retryable jobs with shared options', async () => {
    const user = await createUserWithRole(prisma, 'owner-sync-fail@integration.test', OWNER_PASSWORD, 'owner');
    const agent = request.agent(getHttpServer(app));

    await login(agent, user.email, OWNER_PASSWORD);

    const enqueueResponse = await agent.post('/v1/sync/pedagogical/run').expect(200);
    const enqueueBody = readBody<{ jobId: string; status: string }>(enqueueResponse);
    const job = await queue.getJob(enqueueBody.jobId);

    expect(job?.data).toEqual({
      triggeredByUserId: user.id,
      mode: 'manual',
    });
    expect(job?.opts.attempts).toBe(PEDAGOGICAL_SYNC_JOB_OPTIONS.attempts);
    expect(job?.opts.backoff).toMatchObject(PEDAGOGICAL_SYNC_JOB_OPTIONS.backoff);

    const fetchMock = jest.spyOn(global, 'fetch');
    setPedagogicalApiMock(fetchMock, {
      authStatus: 200,
      authBody: { token: 'pedagogical-token' },
      companiesStatus: 503,
      companiesBody: { error: 'temporary failure' },
    });

    await request(getHttpServer(app))
      .post('/v1/sync/internal/pedagogical/execute')
      .set('x-internal-sync-secret', process.env.INTERNAL_SYNC_SECRET!)
      .send({
        triggeredByUserId: user.id,
        mode: 'manual',
      })
      .expect(503);

    const failedRun = await prisma.pedagogicalSyncRun.findFirst({
      orderBy: {
        startedAt: 'desc',
      },
    });

    expect(failedRun?.status).toBe('FAILED');
    expect(failedRun?.triggeredByUserId).toBe(user.id);
    expect(failedRun?.summary).toMatchObject({
      category: 'external_dependency',
      message: 'Falha ao consultar o sistema pedagogico (503).',
      status: 503,
    });
  });

  it(
    'keeps the previously published snapshot visible when a later sync fails mid-flight',
    async () => {
      const company = buildCompany();
      const student = buildStudent();
      const user = await createUserWithRole(prisma, 'owner-sync-atomic@integration.test', OWNER_PASSWORD, 'owner');
      const agent = request.agent(getHttpServer(app));
      const fetchMock = jest.spyOn(global, 'fetch');

      await login(agent, user.email, OWNER_PASSWORD);

      setPedagogicalApiMock(fetchMock, {
        authStatus: 200,
        authBody: { token: 'pedagogical-token' },
        companiesStatus: 200,
        companiesBody: [company],
        studentsStatus: 200,
        studentsBody: [student],
      });
      await executeInternalSync(app, user.id);

      setPedagogicalApiMock(fetchMock, {
        authStatus: 200,
        authBody: { token: 'pedagogical-token-2' },
        companiesStatus: 503,
        companiesBody: { error: 'temporary failure' },
      });
      await request(getHttpServer(app))
        .post('/v1/sync/internal/pedagogical/execute')
        .set('x-internal-sync-secret', process.env.INTERNAL_SYNC_SECRET!)
        .send({
          triggeredByUserId: user.id,
          mode: 'manual',
        })
        .expect(503);

      const dashboardAfterFailure = readBody<DashboardSummary>(
        await agent.get('/v1/dashboard/summary').expect(200),
      );
      expect(dashboardAfterFailure).toMatchObject({
        totalCompanies: 1,
        totalStudents: 1,
      });

      const companiesAfterFailure = readBody<PaginatedResponse<{ sourceId: string }>>(
        await agent.get('/v1/empresas').expect(200),
      );
      const studentsAfterFailure = readBody<PaginatedResponse<{ sourceId: string }>>(
        await agent.get('/v1/alunos').expect(200),
      );
      expect(companiesAfterFailure.total).toBe(1);
      expect(studentsAfterFailure.total).toBe(1);

      expect(
        await prisma.pedagogicalSnapshotBatch.count({
          where: {
            status: 'CURRENT',
          },
        }),
      ).toBe(1);
      expect(
        await prisma.pedagogicalSnapshotBatch.count({
          where: {
            status: 'FAILED',
          },
        }),
      ).toBe(1);
    },
    20_000,
  );

  it(
    'tracks issue state lifecycle across sync runs and reflects open issues in overview and dashboard',
    async () => {
    const company = buildCompany();
    const student = buildStudent();
    const user = await createUserWithRole(prisma, 'owner-sync-state@integration.test', OWNER_PASSWORD, 'owner');
    const agent = request.agent(getHttpServer(app));
    const fetchMock = jest.spyOn(global, 'fetch');

    await login(agent, user.email, OWNER_PASSWORD);

    setPedagogicalApiMock(fetchMock, {
      authStatus: 200,
      authBody: { token: 'pedagogical-token' },
      companiesStatus: 200,
      companiesBody: [company],
      studentsStatus: 200,
      studentsBody: [student],
    });
    await executeInternalSync(app, user.id);

    const cleanOverview = readBody<SyncOverview>(
      await agent.get('/v1/sync/pedagogical/overview').expect(200),
    );
    expect(cleanOverview.openIssues).toBe(0);

    const cleanDashboard = readBody<DashboardSummary>(
      await agent.get('/v1/dashboard/summary').expect(200),
    );
    expect(cleanDashboard).toMatchObject({
      totalCompanies: 1,
      totalStudents: 1,
      openIssues: 0,
    });

    setPedagogicalApiMock(fetchMock, {
      authStatus: 200,
      authBody: { token: 'pedagogical-token-2' },
      companiesStatus: 200,
      companiesBody: [],
      studentsStatus: 200,
      studentsBody: [],
    });
    await executeInternalSync(app, user.id);

    const firstOpenIssues = readBody<PaginatedResponse<SyncIssueStateItem>>(
      await agent
        .get('/v1/sync/pedagogical/issues')
        .query({ status: 'open' })
        .expect(200),
    );
    expect(firstOpenIssues.total).toBe(2);
    expect(firstOpenIssues.items.every((item) => item.status === 'open')).toBe(true);

    const firstStateIds = firstOpenIssues.items.map((item) => item.id).sort();
    const manuallyResolvedIssueId = firstOpenIssues.items[0]?.id;
    expect(manuallyResolvedIssueId).toBeTruthy();
    if (!manuallyResolvedIssueId) {
      throw new Error('Expected at least one issue state to resolve manually.');
    }

    const partialOverview = readBody<SyncOverview>(
      await agent.get('/v1/sync/pedagogical/overview').expect(200),
    );
    expect(partialOverview.openIssues).toBe(2);

    const partialDashboard = readBody<DashboardSummary>(
      await agent.get('/v1/dashboard/summary').expect(200),
    );
    expect(partialDashboard.openIssues).toBe(2);
    expect(await prisma.pedagogicalSyncIssue.count()).toBe(2);

    const manuallyResolvedIssue = readBody<SyncIssueStateItem>(
      await agent
        .patch(`/v1/sync/pedagogical/issues/${manuallyResolvedIssueId}/resolve`)
        .send({
          note: 'Aceito pela operacao.',
        })
        .expect(200),
    );
    expect(manuallyResolvedIssue).toMatchObject({
      id: manuallyResolvedIssueId,
      status: 'resolved',
      resolutionType: 'MANUAL',
      resolutionNote: 'Aceito pela operacao.',
      resolvedByUserId: user.id,
    });

    const overviewAfterManualResolution = readBody<SyncOverview>(
      await agent.get('/v1/sync/pedagogical/overview').expect(200),
    );
    expect(overviewAfterManualResolution.openIssues).toBe(1);

    const manuallyResolvedIssues = readBody<PaginatedResponse<SyncIssueStateItem>>(
      await agent
        .get('/v1/sync/pedagogical/issues')
        .query({ status: 'resolved', resolutionType: 'MANUAL' })
        .expect(200),
    );
    expect(manuallyResolvedIssues.total).toBe(1);

    setPedagogicalApiMock(fetchMock, {
      authStatus: 200,
      authBody: { token: 'pedagogical-token-3' },
      companiesStatus: 200,
      companiesBody: [],
      studentsStatus: 200,
      studentsBody: [],
    });
    await executeInternalSync(app, user.id);

    const secondOpenIssues = readBody<PaginatedResponse<SyncIssueStateItem>>(
      await agent
        .get('/v1/sync/pedagogical/issues')
        .query({ status: 'open' })
        .expect(200),
    );
    expect(secondOpenIssues.total).toBe(2);
    expect(secondOpenIssues.items.map((item) => item.id).sort()).toEqual(firstStateIds);
    const reopenedIssue = secondOpenIssues.items.find((item) => item.id === manuallyResolvedIssueId);
    expect(reopenedIssue).toMatchObject({
      status: 'open',
      resolutionType: null,
      resolutionNote: null,
      resolvedByUserId: null,
    });
    expect(await prisma.pedagogicalSyncIssue.count()).toBe(4);

    setPedagogicalApiMock(fetchMock, {
      authStatus: 200,
      authBody: { token: 'pedagogical-token-4' },
      companiesStatus: 200,
      companiesBody: [company],
      studentsStatus: 200,
      studentsBody: [student],
    });
    await executeInternalSync(app, user.id);

    const openIssuesAfterResolution = readBody<PaginatedResponse<SyncIssueStateItem>>(
      await agent
        .get('/v1/sync/pedagogical/issues')
        .query({ status: 'open' })
        .expect(200),
    );
    expect(openIssuesAfterResolution.total).toBe(0);

    const resolvedIssues = readBody<PaginatedResponse<SyncIssueStateItem>>(
      await agent
        .get('/v1/sync/pedagogical/issues')
        .query({ status: 'resolved' })
        .expect(200),
    );
    expect(resolvedIssues.total).toBe(2);
    expect(resolvedIssues.items.every((item) => item.resolvedAt !== null)).toBe(true);
    expect(resolvedIssues.items.every((item) => item.resolutionType === 'AUTO_SYNC')).toBe(true);

    const resolvedOverview = readBody<SyncOverview>(
      await agent.get('/v1/sync/pedagogical/overview').expect(200),
    );
    expect(resolvedOverview.openIssues).toBe(0);

    const resolvedDashboard = readBody<DashboardSummary>(
      await agent.get('/v1/dashboard/summary').expect(200),
    );
    expect(resolvedDashboard.openIssues).toBe(0);
    },
    20_000,
  );

  it(
    'supports paginated pedagogical collections without materializing the full upstream dataset first',
    async () => {
      const user = await createUserWithRole(
        prisma,
        'owner-sync-pagination@integration.test',
        OWNER_PASSWORD,
        'owner',
      );
      const agent = request.agent(getHttpServer(app));
      const fetchMock = jest.spyOn(global, 'fetch');

      await login(agent, user.email, OWNER_PASSWORD);

      setPedagogicalApiMock(fetchMock, {
        authStatus: 200,
        authBody: { token: 'pedagogical-token-pagination' },
        companiesPages: [[buildCompany('company-1')], [buildCompany('company-2')]],
        studentsPages: [
          [buildStudent('student-1', 'company-1')],
          [buildStudent('student-2', 'company-2')],
        ],
      });

      await executeInternalSync(app, user.id);

      const dashboard = readBody<DashboardSummary>(
        await agent.get('/v1/dashboard/summary').expect(200),
      );
      expect(dashboard).toMatchObject({
        totalCompanies: 2,
        totalStudents: 2,
        openIssues: 0,
      });

      const companies = readBody<PaginatedResponse<{ sourceId: string }>>(
        await agent.get('/v1/empresas').expect(200),
      );
      const students = readBody<PaginatedResponse<{ sourceId: string }>>(
        await agent.get('/v1/alunos').expect(200),
      );

      expect(companies.total).toBe(2);
      expect(students.total).toBe(2);
      expect(companies.items.map((item) => item.sourceId).sort()).toEqual([
        'company-1',
        'company-2',
      ]);
      expect(students.items.map((item) => item.sourceId).sort()).toEqual([
        'student-1',
        'student-2',
      ]);
    },
    20_000,
  );

  it(
    'covers iam catalog, user management and owner safety rules',
    async () => {
    const owner = await createUserWithRole(prisma, 'owner-iam@integration.test', OWNER_PASSWORD, 'owner');
    const agent = request.agent(getHttpServer(app));

    await login(agent, owner.email, OWNER_PASSWORD);

    const permissionsResponse = readBody<IamPermissionItem[]>(
      await agent.get('/v1/iam/permissions').expect(200),
    );
    expect(permissionsResponse.some((permission) => permission.name === 'iam.users.manage')).toBe(true);

    const rolesResponse = readBody<IamRoleItem[]>(
      await agent.get('/v1/iam/roles').expect(200),
    );
    expect(
      rolesResponse.find((role) => role.name === 'owner')?.permissions.includes('iam.users.manage'),
    ).toBe(true);

    const createdUser = readBody<IamUserDetail>(
      await agent
        .post('/v1/iam/users')
        .send({
          name: 'Analista',
          email: 'analista-iam@integration.test',
          password: 'Analista123!',
          roles: ['analista_financeiro'],
        })
        .expect(201),
    );
    expect(createdUser).toMatchObject({
      email: 'analista-iam@integration.test',
      status: 'ACTIVE',
      roles: ['analista_financeiro'],
    });

    const listedUsers = readBody<PaginatedResponse<IamUserListItem>>(
      await agent
        .get('/v1/iam/users')
        .query({ search: 'analista-iam@integration.test' })
        .expect(200),
    );
    expect(listedUsers.total).toBe(1);

    const detailedUser = readBody<IamUserDetail>(
      await agent.get(`/v1/iam/users/${createdUser.id}`).expect(200),
    );
    expect(detailedUser.permissions).toEqual(expect.arrayContaining(['companies.read', 'students.read']));

    const inactiveUser = readBody<IamUserDetail>(
      await agent
        .patch(`/v1/iam/users/${createdUser.id}/status`)
        .send({
          status: 'INACTIVE',
        })
        .expect(200),
    );
    expect(inactiveUser.status).toBe('INACTIVE');

    const updatedRolesUser = readBody<IamUserDetail>(
      await agent
        .put(`/v1/iam/users/${createdUser.id}/roles`)
        .send({
          roles: ['auditor'],
        })
        .expect(200),
    );
    expect(updatedRolesUser.roles).toEqual(['auditor']);
    expect(updatedRolesUser.permissions).toContain('audit.read');

    await agent
      .patch(`/v1/iam/users/${owner.id}/status`)
      .send({
        status: 'INACTIVE',
      })
      .expect(403);

    await agent
      .put(`/v1/iam/users/${owner.id}/roles`)
      .send({
        roles: ['auditor'],
      })
      .expect(403);
    },
    20_000,
  );
});

async function login(
  agent: ReturnType<typeof request.agent>,
  email: string,
  password: string,
) {
  return agent.post('/v1/auth/login').send({ email, password }).expect(200);
}

async function executeInternalSync(app: INestApplication, triggeredByUserId: string) {
  return request(getHttpServer(app))
    .post('/v1/sync/internal/pedagogical/execute')
    .set('x-internal-sync-secret', process.env.INTERNAL_SYNC_SECRET!)
    .send({ triggeredByUserId, mode: 'manual' })
    .expect((response) => {
      expect([200, 201]).toContain(response.status);
    });
}

async function createUserWithRole(
  prisma: PrismaService,
  email: string,
  password: string,
  roleName: AppRole,
) {
  const role = await prisma.role.findUniqueOrThrow({
    where: { name: roleName },
  });
  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
  });
  const user = await prisma.user.create({
    data: {
      name: email.split('@')[0] ?? 'integration-user',
      email,
      passwordHash,
      status: 'ACTIVE',
    },
  });

  await prisma.userRole.create({
    data: {
      userId: user.id,
      roleId: role.id,
    },
  });

  return user;
}

function getHttpServer(app: INestApplication): HttpServer {
  return app.getHttpServer() as HttpServer;
}

function readBody<T>(response: request.Response): T {
  return response.body as T;
}

async function ensureRbacSeed(prisma: PrismaService) {
  for (const permissionName of permissions) {
    await prisma.permission.upsert({
      where: { name: permissionName },
      update: {},
      create: {
        name: permissionName,
      },
    });
  }

  for (const roleName of roles) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: {
        name: roleName,
      },
    });

    for (const permissionName of rolePermissions[roleName]) {
      const permission = await prisma.permission.findUniqueOrThrow({
        where: { name: permissionName },
      });

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: permission.id,
        },
      });
    }
  }
}

async function resetDatabase(prisma: PrismaService) {
  const bootstrapEmail = process.env.ADMIN_BOOTSTRAP_EMAIL ?? null;
  await prisma.pedagogicalIssueState.deleteMany();
  await prisma.pedagogicalSyncIssue.deleteMany();
  await prisma.pedagogicalStudentSnapshot.deleteMany();
  await prisma.pedagogicalCompanySnapshot.deleteMany();
  await prisma.pedagogicalSnapshotBatch.deleteMany();
  await prisma.pedagogicalSyncRun.deleteMany();
  await prisma.auditEvent.deleteMany();
  await prisma.loginAttempt.deleteMany();
  await prisma.session.deleteMany();
  await prisma.userRole.deleteMany({
    where: {
      user: {
        OR: [
          {
            email: {
              contains: '@integration.test',
            },
          },
          ...(bootstrapEmail
            ? [
                {
                  email: bootstrapEmail,
                },
              ]
            : []),
        ],
      },
    },
  });
  await prisma.user.deleteMany({
    where: {
      OR: [
        {
          email: {
            contains: '@integration.test',
          },
        },
        ...(bootstrapEmail
          ? [
              {
                email: bootstrapEmail,
              },
            ]
          : []),
      ],
    },
  });
}

function setPedagogicalApiMock(
  fetchMock: jest.SpiedFunction<typeof fetch>,
  options: {
    authStatus: number;
    authBody: unknown;
    companiesStatus?: number;
    companiesBody?: unknown;
    companiesPages?: unknown[][];
    studentsStatus?: number;
    studentsBody?: unknown;
    studentsPages?: unknown[][];
  },
) {
  fetchMock.mockImplementation((input) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    const parsedUrl = new URL(url, 'http://pedagogical.local');

    if (parsedUrl.pathname.endsWith('/auth/login')) {
      return Promise.resolve(jsonResponse(options.authStatus, options.authBody));
    }

    if (parsedUrl.pathname.endsWith('/empresas')) {
      if (options.companiesPages) {
        const page = Number(parsedUrl.searchParams.get('page') ?? '1');
        const totalPages = options.companiesPages.length;
        const items = options.companiesPages[page - 1] ?? [];
        return Promise.resolve(
          jsonResponse(options.companiesStatus ?? 200, {
            items,
            page,
            totalPages,
            nextPage: page < totalPages ? page + 1 : null,
          }),
        );
      }

      return Promise.resolve(jsonResponse(options.companiesStatus ?? 200, options.companiesBody ?? []));
    }

    if (parsedUrl.pathname.endsWith('/alunos')) {
      if (options.studentsPages) {
        const page = Number(parsedUrl.searchParams.get('page') ?? '1');
        const totalPages = options.studentsPages.length;
        const items = options.studentsPages[page - 1] ?? [];
        return Promise.resolve(
          jsonResponse(options.studentsStatus ?? 200, {
            items,
            page,
            totalPages,
            nextPage: page < totalPages ? page + 1 : null,
          }),
        );
      }

      return Promise.resolve(jsonResponse(options.studentsStatus ?? 200, options.studentsBody ?? []));
    }

    return Promise.resolve(
      jsonResponse(404, {
        error: 'not_found',
      }),
    );
  });
}
