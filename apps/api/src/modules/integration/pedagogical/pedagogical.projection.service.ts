import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { Prisma, type SyncIssueSeverity } from '@prisma/client';
import type {
  PedagogicalCompany,
  PedagogicalStudent,
} from '@financial-martec/contracts';
import { PEDAGOGICAL_SYNC_LEASE_KEY } from '@financial-martec/contracts';
import { randomUUID } from 'crypto';
import { ExternalDependencyException } from '@/common/exceptions/external-dependency.exception';
import { sha256, stableJson } from '@/common/lib/hash.util';
import { PrismaService } from '@/common/prisma/prisma.service';
import { RedisService } from '@/common/redis/redis.service';
import { PedagogicalClientService } from './pedagogical.client';

const SYNC_LEASE_TTL_MS = 2 * 60 * 1000;
const SYNC_HEARTBEAT_INTERVAL_MS = 30 * 1000;
const STALE_RUN_THRESHOLD_MS = 5 * 60 * 1000;
const SNAPSHOT_WRITE_CHUNK_SIZE = 500;
const SNAPSHOT_WRITE_CONCURRENCY = 4;
const SNAPSHOT_LOOKUP_CHUNK_SIZE = 1_000;
const RETIRED_BATCH_CLEANUP_CHUNK_SIZE = 10;

type IssueDraft = {
  entityType: string;
  entitySourceId: string | null;
  severity: SyncIssueSeverity;
  code: string;
  message: string;
  metadata?: Record<string, unknown> | null;
};

type FailureSummary = {
  category: 'external_dependency' | 'auth' | 'unexpected';
  message: string;
  status?: number;
};

type HeartbeatState = {
  lost: boolean;
};

type SyncMetrics = {
  companiesFetched: number;
  studentsFetched: number;
  companiesUpserted: number;
  studentsUpserted: number;
  issues: number;
  openIssues: number;
  durationsMs: Record<string, number>;
};

type CompanyPageNormalization = {
  companiesBySourceId: Map<string, PedagogicalCompany>;
  existingSourceIds: Set<string>;
  issues: IssueDraft[];
};

type StudentPageNormalization = {
  studentsBySourceId: Map<string, PedagogicalStudent>;
  existingSourceIds: Set<string>;
  companySourceIds: Set<string>;
  issues: IssueDraft[];
};

type CollectionSyncResult = {
  sourceIds: Set<string>;
  issues: IssueDraft[];
};

function parseDate(value?: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toError(error: unknown) {
  if (error instanceof Error) {
    return error;
  }

  return new Error(typeof error === 'string' ? error : 'Unknown chunk processing failure.');
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

async function runChunkedWithConcurrency<T>(
  items: Iterable<T>,
  chunkSize: number,
  concurrency: number,
  worker: (chunk: T[]) => Promise<void>,
) {
  if (chunkSize <= 0 || concurrency <= 0) {
    return;
  }

  const inFlight = new Set<Promise<void>>();
  let currentChunk: T[] = [];
  let firstError: unknown = null;

  const enqueueChunk = async (chunk: T[]) => {
    const task = worker(chunk)
      .catch((error: unknown) => {
        if (firstError === null) {
          firstError = error;
        }
        throw toError(error);
      })
      .finally(() => {
        inFlight.delete(task);
      });
    inFlight.add(task);

    if (inFlight.size >= concurrency) {
      try {
        await Promise.race(inFlight);
      } catch {
        // A falha real sera relancada apos drenar os writes em voo do batch atual.
      }

      if (firstError !== null) {
        throw toError(firstError);
      }
    }
  };

  try {
    for (const item of items) {
      currentChunk.push(item);
      if (currentChunk.length === chunkSize) {
        await enqueueChunk(currentChunk);
        currentChunk = [];
      }
    }

    if (currentChunk.length) {
      await enqueueChunk(currentChunk);
    }
  } catch (error) {
    if (firstError === null) {
      firstError = error;
    }
  } finally {
    if (inFlight.size) {
      await Promise.allSettled([...inFlight]);
    }
  }

  if (firstError !== null) {
    throw toError(firstError);
  }
}

@Injectable()
export class PedagogicalProjectionService {
  private readonly logger = new Logger(PedagogicalProjectionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: PedagogicalClientService,
    private readonly redis: RedisService,
  ) {}

  async recoverStaleRuns() {
    const staleBefore = new Date(Date.now() - STALE_RUN_THRESHOLD_MS);
    const staleRuns = await this.prisma.pedagogicalSyncRun.findMany({
      where: {
        status: 'RUNNING',
        OR: [
          {
            heartbeatAt: null,
          },
          {
            heartbeatAt: {
              lt: staleBefore,
            },
          },
        ],
      },
      select: {
        id: true,
        snapshotBatch: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    if (!staleRuns.length) {
      return 0;
    }

    const recoveredAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      for (const staleRun of staleRuns) {
        if (staleRun.snapshotBatch?.status === 'STAGING') {
          await tx.pedagogicalSnapshotBatch.update({
            where: {
              id: staleRun.snapshotBatch.id,
            },
            data: {
              status: 'FAILED',
              finishedAt: recoveredAt,
            },
          });
        }

        await tx.pedagogicalSyncRun.update({
          where: {
            id: staleRun.id,
          },
          data: {
            status: 'FAILED',
            finishedAt: recoveredAt,
            heartbeatAt: recoveredAt,
            leaseToken: null,
            summary: {
              category: 'unexpected',
              message: 'Execucao marcada como FAILED por heartbeat expirado.',
            },
          },
        });
      }
    });

    await this.redis.getClient().del(PEDAGOGICAL_SYNC_LEASE_KEY);
    await this.cleanupRetiredBatchData();
    this.logger.warn(`Recovered ${staleRuns.length} stale sync run(s).`);

    return staleRuns.length;
  }

  async runFullSync(
    triggeredByUserId?: string | null,
    mode: 'manual' | 'schedule' | 'startup' = 'manual',
  ) {
    await this.recoverStaleRuns();

    const leaseToken = randomUUID();
    const leaseAcquired = await this.acquireLease(leaseToken);
    if (!leaseAcquired) {
      throw new ConflictException('Ja existe uma sincronizacao do pedagogico em andamento.');
    }

    const syncStartedAt = Date.now();
    const syncTimestamp = new Date();
    const metrics: SyncMetrics = {
      companiesFetched: 0,
      studentsFetched: 0,
      companiesUpserted: 0,
      studentsUpserted: 0,
      issues: 0,
      openIssues: 0,
      durationsMs: {},
    };
    const heartbeatState: HeartbeatState = {
      lost: false,
    };

    let runId: string | null = null;
    let snapshotBatchId: string | null = null;
    let heartbeatHandle: NodeJS.Timeout | null = null;

    try {
      const run = await this.prisma.pedagogicalSyncRun.create({
        data: {
          mode,
          triggeredByUserId: triggeredByUserId ?? null,
          status: 'RUNNING',
          leaseToken,
          heartbeatAt: syncTimestamp,
        },
      });
      runId = run.id;

      const snapshotBatch = await this.prisma.pedagogicalSnapshotBatch.create({
        data: {
          syncRunId: run.id,
          status: 'STAGING',
        },
      });
      snapshotBatchId = snapshotBatch.id;
      heartbeatHandle = this.startHeartbeat(run.id, leaseToken, heartbeatState);

      const previousCurrentBatch = await this.prisma.pedagogicalSnapshotBatch.findFirst({
        where: {
          status: 'CURRENT',
        },
        orderBy: {
          publishedAt: 'desc',
        },
        select: {
          id: true,
        },
      });

      const issues: IssueDraft[] = [];

      const companySync = await this.syncCompaniesSnapshot(
        run.id,
        snapshotBatch.id,
        syncTimestamp,
        leaseToken,
        heartbeatState,
        metrics,
      );
      metrics.issues += companySync.issues.length;
      issues.push(...companySync.issues);

      const studentSync = await this.syncStudentsSnapshot(
        run.id,
        snapshotBatch.id,
        syncTimestamp,
        leaseToken,
        heartbeatState,
        metrics,
      );
      metrics.issues += studentSync.issues.length;
      issues.push(...studentSync.issues);

      const reconcileStartedAt = Date.now();
      const missingRemoteIssues = await this.collectMissingRemoteIssues(
        previousCurrentBatch?.id ?? null,
        companySync.sourceIds,
        studentSync.sourceIds,
      );
      metrics.issues += missingRemoteIssues.length;
      issues.push(...missingRemoteIssues);

      metrics.openIssues = await this.finalizeSuccess(
        run.id,
        snapshotBatch.id,
        issues,
        metrics,
        syncStartedAt,
      );
      metrics.durationsMs.reconcileIssues = Date.now() - reconcileStartedAt;

      await this.cleanupRetiredBatchData();

      return this.prisma.pedagogicalSyncRun.findUniqueOrThrow({
        where: {
          id: run.id,
        },
        include: {
          issues: true,
        },
      });
    } catch (error) {
      if (runId) {
        await this.finalizeFailure(
          runId,
          snapshotBatchId,
          this.toFailureSummary(error),
          metrics,
          syncStartedAt,
        );
        await this.cleanupRetiredBatchData();
      }

      throw error;
    } finally {
      if (heartbeatHandle) {
        clearInterval(heartbeatHandle);
      }

      await this.releaseLease(leaseToken);
    }
  }

  private async syncCompaniesSnapshot(
    runId: string,
    batchId: string,
    syncTimestamp: Date,
    leaseToken: string,
    heartbeatState: HeartbeatState,
    metrics: SyncMetrics,
  ): Promise<CollectionSyncResult> {
    const sourceIds = new Set<string>();
    const seenSourceIds = new Set<string>();
    const issues: IssueDraft[] = [];

    await this.assertLeaseAlive(runId, leaseToken, heartbeatState);

    for await (const page of this.client.streamCompanies()) {
      metrics.companiesFetched += page.items.length;
      metrics.durationsMs.fetchCompanies =
        (metrics.durationsMs.fetchCompanies ?? 0) + page.fetchDurationMs;

      const normalizeStartedAt = Date.now();
      const normalized = this.normalizeCompaniesPage(page.items, seenSourceIds);
      metrics.durationsMs.normalizeCompanies =
        (metrics.durationsMs.normalizeCompanies ?? 0) + (Date.now() - normalizeStartedAt);

      issues.push(...normalized.issues);

      if (!normalized.companiesBySourceId.size) {
        await this.assertLeaseAlive(runId, leaseToken, heartbeatState);
        continue;
      }

      const upsertStartedAt = Date.now();
      await this.upsertCompaniesPage(batchId, normalized, syncTimestamp);
      metrics.durationsMs.upsertCompanies =
        (metrics.durationsMs.upsertCompanies ?? 0) + (Date.now() - upsertStartedAt);

      for (const sourceId of normalized.companiesBySourceId.keys()) {
        sourceIds.add(sourceId);
      }
      metrics.companiesUpserted = sourceIds.size;

      await this.assertLeaseAlive(runId, leaseToken, heartbeatState);
    }

    return {
      sourceIds,
      issues,
    };
  }

  private async syncStudentsSnapshot(
    runId: string,
    batchId: string,
    syncTimestamp: Date,
    leaseToken: string,
    heartbeatState: HeartbeatState,
    metrics: SyncMetrics,
  ): Promise<CollectionSyncResult> {
    const sourceIds = new Set<string>();
    const seenSourceIds = new Set<string>();
    const issues: IssueDraft[] = [];

    await this.assertLeaseAlive(runId, leaseToken, heartbeatState);

    for await (const page of this.client.streamStudents()) {
      metrics.studentsFetched += page.items.length;
      metrics.durationsMs.fetchStudents =
        (metrics.durationsMs.fetchStudents ?? 0) + page.fetchDurationMs;

      const normalizeStartedAt = Date.now();
      const normalized = this.normalizeStudentsPage(page.items, seenSourceIds);
      metrics.durationsMs.normalizeStudents =
        (metrics.durationsMs.normalizeStudents ?? 0) + (Date.now() - normalizeStartedAt);

      issues.push(...normalized.issues);

      if (!normalized.studentsBySourceId.size) {
        await this.assertLeaseAlive(runId, leaseToken, heartbeatState);
        continue;
      }

      const loadCompanyMapStartedAt = Date.now();
      const companySnapshotMap = await this.loadCompanySnapshotMap(
        batchId,
        normalized.companySourceIds,
      );
      metrics.durationsMs.loadStudentCompanyMap =
        (metrics.durationsMs.loadStudentCompanyMap ?? 0) +
        (Date.now() - loadCompanyMapStartedAt);

      const upsertStartedAt = Date.now();
      const upsertResult = await this.upsertStudentsPage(
        batchId,
        normalized,
        companySnapshotMap,
        syncTimestamp,
      );
      metrics.durationsMs.upsertStudents =
        (metrics.durationsMs.upsertStudents ?? 0) + (Date.now() - upsertStartedAt);

      issues.push(...upsertResult.issues);

      for (const sourceId of normalized.studentsBySourceId.keys()) {
        sourceIds.add(sourceId);
      }
      metrics.studentsUpserted = sourceIds.size;

      await this.assertLeaseAlive(runId, leaseToken, heartbeatState);
    }

    return {
      sourceIds,
      issues,
    };
  }

  private normalizeCompaniesPage(
    companies: PedagogicalCompany[],
    seenSourceIds: Set<string>,
  ): CompanyPageNormalization {
    const companiesBySourceId = new Map<string, PedagogicalCompany>();
    const duplicateIds = new Set<string>();
    const existingSourceIds = new Set<string>();

    for (const company of companies) {
      if (seenSourceIds.has(company.id)) {
        duplicateIds.add(company.id);
        existingSourceIds.add(company.id);
      }

      if (companiesBySourceId.has(company.id)) {
        duplicateIds.add(company.id);
      }

      companiesBySourceId.set(company.id, company);
    }

    for (const sourceId of companiesBySourceId.keys()) {
      seenSourceIds.add(sourceId);
    }

    return {
      companiesBySourceId,
      existingSourceIds,
      issues: [...duplicateIds].map<IssueDraft>((sourceId) => ({
        entityType: 'company',
        entitySourceId: sourceId,
        severity: 'WARNING',
        code: 'duplicate_remote_record',
        message: 'Empresa duplicada retornada pela API pedagogica; ultimo payload prevaleceu.',
      })),
    };
  }

  private normalizeStudentsPage(
    students: PedagogicalStudent[],
    seenSourceIds: Set<string>,
  ): StudentPageNormalization {
    const studentsBySourceId = new Map<string, PedagogicalStudent>();
    const duplicateIds = new Set<string>();
    const existingSourceIds = new Set<string>();

    for (const student of students) {
      if (seenSourceIds.has(student.id)) {
        duplicateIds.add(student.id);
        existingSourceIds.add(student.id);
      }

      if (studentsBySourceId.has(student.id)) {
        duplicateIds.add(student.id);
      }

      studentsBySourceId.set(student.id, student);
    }

    for (const sourceId of studentsBySourceId.keys()) {
      seenSourceIds.add(sourceId);
    }

    const companySourceIds = new Set<string>();
    for (const student of studentsBySourceId.values()) {
      companySourceIds.add(student.empresa_id);
    }

    return {
      studentsBySourceId,
      existingSourceIds,
      companySourceIds,
      issues: [...duplicateIds].map<IssueDraft>((sourceId) => ({
        entityType: 'student',
        entitySourceId: sourceId,
        severity: 'WARNING',
        code: 'duplicate_remote_record',
        message: 'Aluno duplicado retornado pela API pedagogica; ultimo payload prevaleceu.',
      })),
    };
  }

  private async upsertCompaniesPage(
    batchId: string,
    normalization: CompanyPageNormalization,
    syncTimestamp: Date,
  ) {
    const companiesToInsert = new Map<string, PedagogicalCompany>();
    const companiesToUpdate = new Map<string, PedagogicalCompany>();

    for (const [sourceId, company] of normalization.companiesBySourceId.entries()) {
      if (normalization.existingSourceIds.has(sourceId)) {
        companiesToUpdate.set(sourceId, company);
        continue;
      }

      companiesToInsert.set(sourceId, company);
    }

    if (companiesToInsert.size) {
      await this.insertCompanies(batchId, companiesToInsert, syncTimestamp);
    }

    if (companiesToUpdate.size) {
      await this.updateCompanies(batchId, companiesToUpdate, syncTimestamp);
    }
  }

  private async upsertStudentsPage(
    batchId: string,
    normalization: StudentPageNormalization,
    companySnapshotMap: Map<string, string>,
    syncTimestamp: Date,
  ) {
    const studentsToInsert = new Map<string, PedagogicalStudent>();
    const studentsToUpdate = new Map<string, PedagogicalStudent>();

    for (const [sourceId, student] of normalization.studentsBySourceId.entries()) {
      if (normalization.existingSourceIds.has(sourceId)) {
        studentsToUpdate.set(sourceId, student);
        continue;
      }

      studentsToInsert.set(sourceId, student);
    }

    const issues: IssueDraft[] = [];

    if (studentsToInsert.size) {
      const insertResult = await this.insertStudents(
        batchId,
        studentsToInsert,
        companySnapshotMap,
        syncTimestamp,
      );
      issues.push(...insertResult.issues);
    }

    if (studentsToUpdate.size) {
      const updateResult = await this.updateStudents(
        batchId,
        studentsToUpdate,
        companySnapshotMap,
        syncTimestamp,
      );
      issues.push(...updateResult.issues);
    }

    return {
      issues: this.deduplicateIssues(issues),
    };
  }

  private async insertCompanies(
    batchId: string,
    companiesBySourceId: Map<string, PedagogicalCompany>,
    syncTimestamp: Date,
  ) {
    await runChunkedWithConcurrency(
      companiesBySourceId.values(),
      SNAPSHOT_WRITE_CHUNK_SIZE,
      SNAPSHOT_WRITE_CONCURRENCY,
      async (chunk) => {
        await this.prisma.pedagogicalCompanySnapshot.createMany({
          data: chunk.map((company) => ({
            batchId,
            sourceId: company.id,
            name: company.nome,
            legalName: company.razao_social ?? null,
            taxId: company.cnpj ?? null,
            email: company.email ?? null,
            phone: company.telefone ?? null,
            payloadHash: sha256(stableJson(company)),
            sourceUpdatedAt: parseDate(company.criado_em),
            lastSyncedAt: syncTimestamp,
            data: company as unknown as Prisma.InputJsonValue,
          })),
        });
      },
    );
  }

  private async updateCompanies(
    batchId: string,
    companiesBySourceId: Map<string, PedagogicalCompany>,
    syncTimestamp: Date,
  ) {
    const updates = [...companiesBySourceId.values()];
    const chunks = chunkArray(updates, SNAPSHOT_WRITE_CHUNK_SIZE);

    for (const chunk of chunks) {
      await this.prisma.$transaction(
        chunk.map((company) =>
          this.prisma.pedagogicalCompanySnapshot.update({
            where: {
              batchId_sourceId: {
                batchId,
                sourceId: company.id,
              },
            },
            data: {
              name: company.nome,
              legalName: company.razao_social ?? null,
              taxId: company.cnpj ?? null,
              email: company.email ?? null,
              phone: company.telefone ?? null,
              payloadHash: sha256(stableJson(company)),
              sourceUpdatedAt: parseDate(company.criado_em),
              lastSyncedAt: syncTimestamp,
              data: company as unknown as Prisma.InputJsonValue,
            },
          }),
        ),
      );
    }
  }

  private async insertStudents(
    batchId: string,
    studentsBySourceId: Map<string, PedagogicalStudent>,
    companySnapshotMap: Map<string, string>,
    syncTimestamp: Date,
  ) {
    const issues: IssueDraft[] = [];
    await runChunkedWithConcurrency(
      studentsBySourceId.values(),
      SNAPSHOT_WRITE_CHUNK_SIZE,
      SNAPSHOT_WRITE_CONCURRENCY,
      async (chunk) => {
        await this.prisma.pedagogicalStudentSnapshot.createMany({
          data: chunk.map((student) => {
            const companySnapshotId = companySnapshotMap.get(student.empresa_id) ?? null;
            if (!companySnapshotId) {
              issues.push({
                entityType: 'student',
                entitySourceId: student.id,
                severity: 'WARNING',
                code: 'company_reference_missing',
                message:
                  'Aluno retornado pela API pedagogica referencia uma empresa ausente no snapshot atual.',
                metadata: {
                  companySourceId: student.empresa_id,
                },
              });
            }

            return {
              batchId,
              sourceId: student.id,
              companySourceId: student.empresa_id,
              companySnapshotId,
              name: student.nome,
              cpf: student.cpf,
              email: student.email ?? null,
              birthDate: parseDate(student.data_nascimento),
              payloadHash: sha256(stableJson(student)),
              sourceUpdatedAt: parseDate(student.atualizado_em ?? student.criado_em),
              lastSyncedAt: syncTimestamp,
              data: student as unknown as Prisma.InputJsonValue,
            };
          }),
        });
      },
    );

    return {
      issues: this.deduplicateIssues(issues),
    };
  }

  private async updateStudents(
    batchId: string,
    studentsBySourceId: Map<string, PedagogicalStudent>,
    companySnapshotMap: Map<string, string>,
    syncTimestamp: Date,
  ) {
    const issues: IssueDraft[] = [];
    const updates = [...studentsBySourceId.values()];
    const chunks = chunkArray(updates, SNAPSHOT_WRITE_CHUNK_SIZE);

    for (const chunk of chunks) {
      await this.prisma.$transaction(
        chunk.map((student) => {
          const companySnapshotId = companySnapshotMap.get(student.empresa_id) ?? null;
          if (!companySnapshotId) {
            issues.push({
              entityType: 'student',
              entitySourceId: student.id,
              severity: 'WARNING',
              code: 'company_reference_missing',
              message:
                'Aluno retornado pela API pedagogica referencia uma empresa ausente no snapshot atual.',
              metadata: {
                companySourceId: student.empresa_id,
              },
            });
          }

          return this.prisma.pedagogicalStudentSnapshot.update({
            where: {
              batchId_sourceId: {
                batchId,
                sourceId: student.id,
              },
            },
            data: {
              companySourceId: student.empresa_id,
              companySnapshotId,
              name: student.nome,
              cpf: student.cpf,
              email: student.email ?? null,
              birthDate: parseDate(student.data_nascimento),
              payloadHash: sha256(stableJson(student)),
              sourceUpdatedAt: parseDate(student.atualizado_em ?? student.criado_em),
              lastSyncedAt: syncTimestamp,
              data: student as unknown as Prisma.InputJsonValue,
            },
          });
        }),
      );
    }

    return {
      issues: this.deduplicateIssues(issues),
    };
  }

  private async loadCompanySnapshotMap(
    batchId: string,
    companySourceIds: Set<string>,
  ) {
    if (!companySourceIds.size) {
      return new Map<string, string>();
    }

    const sourceIds = [...companySourceIds];
    const chunks = chunkArray(sourceIds, SNAPSHOT_LOOKUP_CHUNK_SIZE);
    const entries: Array<{ sourceId: string; id: string }> = [];

    for (const chunk of chunks) {
      const companies = await this.prisma.pedagogicalCompanySnapshot.findMany({
        where: {
          batchId,
          sourceId: {
            in: chunk,
          },
        },
        select: {
          id: true,
          sourceId: true,
        },
      });
      entries.push(...companies);
    }

    return new Map(entries.map((company) => [company.sourceId, company.id]));
  }

  private async collectMissingRemoteIssues(
    previousCurrentBatchId: string | null,
    remoteCompanyIds: Set<string>,
    remoteStudentIds: Set<string>,
  ) {
    if (!previousCurrentBatchId) {
      return [] as IssueDraft[];
    }

    const [companyIssues, studentIssues] = await Promise.all([
      this.collectMissingIssuesForEntity(
        'company',
        previousCurrentBatchId,
        remoteCompanyIds,
      ),
      this.collectMissingIssuesForEntity(
        'student',
        previousCurrentBatchId,
        remoteStudentIds,
      ),
    ]);

    return [...companyIssues, ...studentIssues];
  }

  private async collectMissingIssuesForEntity(
    entityType: 'company' | 'student',
    batchId: string,
    remoteIds: Set<string>,
  ) {
    const knownSourceIds = new Set<string>();
    let cursorId: string | undefined;

    while (true) {
      const records =
        entityType === 'company'
          ? await this.prisma.pedagogicalCompanySnapshot.findMany({
              where: {
                batchId,
              },
              select: {
                id: true,
                sourceId: true,
              },
              orderBy: {
                id: 'asc',
              },
              take: SNAPSHOT_LOOKUP_CHUNK_SIZE,
              ...(cursorId
                ? {
                    cursor: {
                      id: cursorId,
                    },
                    skip: 1,
                  }
                : {}),
            })
          : await this.prisma.pedagogicalStudentSnapshot.findMany({
              where: {
                batchId,
              },
              select: {
                id: true,
                sourceId: true,
              },
              orderBy: {
                id: 'asc',
              },
              take: SNAPSHOT_LOOKUP_CHUNK_SIZE,
              ...(cursorId
                ? {
                    cursor: {
                      id: cursorId,
                    },
                    skip: 1,
                  }
                : {}),
            });

      if (!records.length) {
        break;
      }

      for (const record of records) {
        knownSourceIds.add(record.sourceId);
      }

      cursorId = records[records.length - 1]?.id;
    }

    const knownIssueStates = await this.prisma.pedagogicalIssueState.findMany({
      where: {
        entityType,
        code: 'missing_in_remote',
        entitySourceId: {
          not: null,
        },
      },
      select: {
        entitySourceId: true,
      },
    });

    for (const issueState of knownIssueStates) {
      if (issueState.entitySourceId) {
        knownSourceIds.add(issueState.entitySourceId);
      }
    }

    return [...knownSourceIds]
      .filter((sourceId) => !remoteIds.has(sourceId))
      .map<IssueDraft>((sourceId) => ({
        entityType,
        entitySourceId: sourceId,
        severity: 'WARNING',
        code: 'missing_in_remote',
        message:
          entityType === 'company'
            ? 'Empresa existe em snapshot anterior, mas nao retornou na API pedagogica.'
            : 'Aluno existe em snapshot anterior, mas nao retornou na API pedagogica.',
      }));
  }

  private async finalizeSuccess(
    runId: string,
    snapshotBatchId: string,
    issues: IssueDraft[],
    metrics: SyncMetrics,
    syncStartedAt: number,
  ) {
    const finalizedAt = new Date();
    const deduplicatedIssues = this.deduplicateIssues(issues);

    return this.prisma.$transaction(async (tx) => {
      await this.persistSyncIssues(tx, runId, deduplicatedIssues);
      const openIssues = await this.reconcileIssueStates(tx, runId, finalizedAt, deduplicatedIssues);

      await tx.pedagogicalSnapshotBatch.updateMany({
        where: {
          status: 'CURRENT',
          id: {
            not: snapshotBatchId,
          },
        },
        data: {
          status: 'SUPERSEDED',
          finishedAt: finalizedAt,
        },
      });

      await tx.pedagogicalSnapshotBatch.update({
        where: {
          id: snapshotBatchId,
        },
        data: {
          status: 'CURRENT',
          publishedAt: finalizedAt,
          finishedAt: finalizedAt,
        },
      });

      await tx.pedagogicalSyncRun.update({
        where: {
          id: runId,
        },
        data: {
          status: deduplicatedIssues.length ? 'PARTIAL' : 'SUCCESS',
          finishedAt: finalizedAt,
          heartbeatAt: finalizedAt,
          leaseToken: null,
          summary: {
            snapshotBatchId,
            companiesFetched: metrics.companiesFetched,
            studentsFetched: metrics.studentsFetched,
            companiesUpserted: metrics.companiesUpserted,
            studentsUpserted: metrics.studentsUpserted,
            issues: deduplicatedIssues.length,
            openIssues,
            durationsMs: {
              ...metrics.durationsMs,
              total: Date.now() - syncStartedAt,
            },
          },
        },
      });

      return openIssues;
    });
  }

  private async finalizeFailure(
    runId: string,
    snapshotBatchId: string | null,
    failure: FailureSummary,
    metrics: SyncMetrics,
    syncStartedAt: number,
  ) {
    const failedAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      if (snapshotBatchId) {
        await tx.pedagogicalSnapshotBatch.update({
          where: {
            id: snapshotBatchId,
          },
          data: {
            status: 'FAILED',
            finishedAt: failedAt,
          },
        });
      }

      await tx.pedagogicalSyncRun.update({
        where: {
          id: runId,
        },
        data: {
          status: 'FAILED',
          finishedAt: failedAt,
          heartbeatAt: failedAt,
          leaseToken: null,
          summary: {
            ...failure,
            companiesFetched: metrics.companiesFetched,
            studentsFetched: metrics.studentsFetched,
            companiesUpserted: metrics.companiesUpserted,
            studentsUpserted: metrics.studentsUpserted,
            durationsMs: {
              ...metrics.durationsMs,
              total: Date.now() - syncStartedAt,
            },
          },
        },
      });
    });
  }

  private deduplicateIssues(issues: IssueDraft[]) {
    const deduplicated = new Map<string, IssueDraft>();
    for (const issue of issues) {
      deduplicated.set(this.buildIssueFingerprint(issue), issue);
    }

    return [...deduplicated.values()];
  }

  private buildIssueFingerprint(issue: IssueDraft) {
    return `${issue.entityType}:${issue.entitySourceId ?? 'null'}:${issue.code}`;
  }

  private async persistSyncIssues(
    tx: Prisma.TransactionClient,
    runId: string,
    issues: IssueDraft[],
  ) {
    const chunks = chunkArray(issues, SNAPSHOT_WRITE_CHUNK_SIZE);
    for (const chunk of chunks) {
      await tx.pedagogicalSyncIssue.createMany({
        data: chunk.map((issue) => ({
          syncRunId: runId,
          entityType: issue.entityType,
          entitySourceId: issue.entitySourceId,
          severity: issue.severity,
          code: issue.code,
          message: issue.message,
          metadata: (issue.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        })),
      });
    }
  }

  private async reconcileIssueStates(
    tx: Prisma.TransactionClient,
    runId: string,
    seenAt: Date,
    issues: IssueDraft[],
  ) {
    const fingerprints = issues.map((issue) => this.buildIssueFingerprint(issue));
    const uniqueFingerprints = [...new Set(fingerprints)];
    const existingStates = await this.findIssueStatesByFingerprints(tx, uniqueFingerprints);
    const existingStatesByFingerprint = new Map(
      existingStates.map((issueState) => [issueState.fingerprint, issueState]),
    );
    const openStates = await tx.pedagogicalIssueState.findMany({
      where: {
        resolvedAt: null,
      },
      select: {
        id: true,
        fingerprint: true,
      },
    });
    const openFingerprints = new Set(uniqueFingerprints);

    for (const issue of issues) {
      const fingerprint = this.buildIssueFingerprint(issue);
      const existingState = existingStatesByFingerprint.get(fingerprint);
      if (!existingState) {
        await tx.pedagogicalIssueState.create({
          data: {
            fingerprint,
            entityType: issue.entityType,
            entitySourceId: issue.entitySourceId,
            code: issue.code,
            severity: issue.severity,
            message: issue.message,
            metadata: (issue.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
            openedAt: seenAt,
            lastSeenAt: seenAt,
            resolvedAt: null,
            resolutionType: null,
            resolutionNote: null,
            resolvedByUserId: null,
            openedByRunId: runId,
            lastSeenByRunId: runId,
            resolvedByRunId: null,
          },
        });
        continue;
      }

      await tx.pedagogicalIssueState.update({
        where: {
          id: existingState.id,
        },
        data: {
          severity: issue.severity,
          message: issue.message,
          metadata: (issue.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
          lastSeenAt: seenAt,
          lastSeenByRunId: runId,
          resolvedAt: null,
          resolutionType: null,
          resolutionNote: null,
          resolvedByUserId: null,
          resolvedByRunId: null,
          ...(existingState.resolvedAt
            ? {
                openedAt: seenAt,
                openedByRunId: runId,
              }
            : {}),
        },
      });
    }

    const issueStateIdsToResolve = openStates
      .filter((issueState) => !openFingerprints.has(issueState.fingerprint))
      .map((issueState) => issueState.id);

    const resolutionChunks = chunkArray(issueStateIdsToResolve, SNAPSHOT_WRITE_CHUNK_SIZE);
    for (const chunk of resolutionChunks) {
      await tx.pedagogicalIssueState.updateMany({
        where: {
          id: {
            in: chunk,
          },
        },
        data: {
          resolvedAt: seenAt,
          resolutionType: 'AUTO_SYNC',
          resolutionNote: null,
          resolvedByUserId: null,
          resolvedByRunId: runId,
        },
      });
    }

    return tx.pedagogicalIssueState.count({
      where: {
        resolvedAt: null,
      },
    });
  }

  private async findIssueStatesByFingerprints(
    tx: Prisma.TransactionClient,
    fingerprints: string[],
  ) {
    if (!fingerprints.length) {
      return [];
    }

    const chunks = chunkArray(fingerprints, SNAPSHOT_LOOKUP_CHUNK_SIZE);
    const results: Array<
      Prisma.PedagogicalIssueStateGetPayload<{
        select: {
          id: true;
          fingerprint: true;
          resolvedAt: true;
        };
      }>
    > = [];

    for (const chunk of chunks) {
      results.push(
        ...(await tx.pedagogicalIssueState.findMany({
          where: {
            fingerprint: {
              in: chunk,
            },
          },
          select: {
            id: true,
            fingerprint: true,
            resolvedAt: true,
          },
        })),
      );
    }

    return results;
  }

  private async cleanupRetiredBatchData() {
    const retiredBatches = await this.prisma.pedagogicalSnapshotBatch.findMany({
      where: {
        status: {
          in: ['FAILED', 'SUPERSEDED'],
        },
      },
      select: {
        id: true,
      },
    });

    if (!retiredBatches.length) {
      return;
    }

    const batchIdChunks = chunkArray(
      retiredBatches.map((batch) => batch.id),
      RETIRED_BATCH_CLEANUP_CHUNK_SIZE,
    );

    for (const chunk of batchIdChunks) {
      await this.prisma.pedagogicalStudentSnapshot.deleteMany({
        where: {
          batchId: {
            in: chunk,
          },
        },
      });
      await this.prisma.pedagogicalCompanySnapshot.deleteMany({
        where: {
          batchId: {
            in: chunk,
          },
        },
      });
    }
  }

  private async acquireLease(leaseToken: string) {
    const result = await this.redis
      .getClient()
      .set(PEDAGOGICAL_SYNC_LEASE_KEY, leaseToken, 'PX', SYNC_LEASE_TTL_MS, 'NX');

    return result === 'OK';
  }

  private startHeartbeat(
    runId: string,
    leaseToken: string,
    heartbeatState: HeartbeatState,
  ) {
    const handle = setInterval(() => {
      void this.refreshHeartbeat(runId, leaseToken).then((refreshed) => {
        if (!refreshed) {
          heartbeatState.lost = true;
        }
      }).catch((error: unknown) => {
        heartbeatState.lost = true;
        this.logger.error(
          `Failed to refresh sync heartbeat for run ${runId}: ${
            error instanceof Error ? error.message : 'unknown'
          }`,
        );
      });
    }, SYNC_HEARTBEAT_INTERVAL_MS);

    handle.unref?.();
    return handle;
  }

  private async assertLeaseAlive(
    runId: string,
    leaseToken: string,
    heartbeatState: HeartbeatState,
  ) {
    if (heartbeatState.lost) {
      throw new Error('Sync lease lost during execution.');
    }

    const refreshed = await this.refreshHeartbeat(runId, leaseToken);
    if (!refreshed) {
      heartbeatState.lost = true;
      throw new Error('Sync lease lost during execution.');
    }
  }

  private async refreshHeartbeat(runId: string, leaseToken: string) {
    const now = new Date();
    const leaseResult = await this.redis
      .getClient()
      .set(PEDAGOGICAL_SYNC_LEASE_KEY, leaseToken, 'PX', SYNC_LEASE_TTL_MS, 'XX');

    if (leaseResult !== 'OK') {
      return false;
    }

    const result = await this.prisma.pedagogicalSyncRun.updateMany({
      where: {
        id: runId,
        status: 'RUNNING',
        leaseToken,
      },
      data: {
        heartbeatAt: now,
      },
    });

    return result.count > 0;
  }

  private async releaseLease(leaseToken: string) {
    await this.redis.getClient().eval(
      `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        end
        return 0
      `,
      1,
      PEDAGOGICAL_SYNC_LEASE_KEY,
      leaseToken,
    );
  }

  private toFailureSummary(error: unknown): FailureSummary {
    if (error instanceof ExternalDependencyException) {
      const response = error.getResponse();
      const details =
        response &&
        typeof response === 'object' &&
        'details' in response &&
        response.details &&
        typeof response.details === 'object'
          ? (response.details as Record<string, unknown>)
          : null;
      const status = typeof details?.status === 'number' ? details.status : undefined;

      return {
        category:
          status === 401 || status === 403 || details?.path === '/auth/login'
            ? 'auth'
            : 'external_dependency',
        message: error.message,
        ...(status ? { status } : {}),
      };
    }

    return {
      category: 'unexpected',
      message: error instanceof Error ? error.message : 'unknown',
    };
  }
}
