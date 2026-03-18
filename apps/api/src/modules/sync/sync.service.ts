import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Queue } from 'bullmq';
import type Redis from 'ioredis';
import type {
  PedagogicalSyncJobPayload,
  SyncIssueItem,
  SyncIssueResolutionType,
  SyncIssueStateItem,
  SyncOverview,
  SyncRunDetail,
  SyncRunListItem,
} from '@financial-martec/contracts';
import {
  PEDAGOGICAL_SYNC_ENQUEUE_LOCK_KEY,
  PEDAGOGICAL_SYNC_ENQUEUE_LOCK_TTL_MS,
  PEDAGOGICAL_SYNC_JOB,
  PEDAGOGICAL_SYNC_IN_FLIGHT_JOB_STATES,
  PEDAGOGICAL_SYNC_JOB_OPTIONS,
  PEDAGOGICAL_SYNC_LEASE_KEY,
  PEDAGOGICAL_SYNC_QUEUE,
} from '@financial-martec/contracts';
import { buildPaginatedResponse } from '@/common/lib/pagination.util';
import { PrismaService } from '@/common/prisma/prisma.service';
import { RedisService } from '@/common/redis/redis.service';
import { AuditService } from '@/modules/audit/audit.service';
import { PedagogicalProjectionService } from '@/modules/integration/pedagogical/pedagogical.projection.service';
import { QuerySyncIssueStatesDto } from './dto/query-sync-issue-states.dto';
import { QuerySyncRunsDto } from './dto/query-sync-runs.dto';

function toRecord(value: Prisma.JsonValue | null | undefined) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

type SyncRunWithSummary = Prisma.PedagogicalSyncRunGetPayload<{
  include: {
    issues: {
      select: {
        id: true;
      };
    };
    triggeredByUser: {
      select: {
        id: true;
        name: true;
        email: true;
      };
    };
  };
}>;

type SyncRunWithDetail = Prisma.PedagogicalSyncRunGetPayload<{
  include: {
    issues: true;
    triggeredByUser: {
      select: {
        id: true;
        name: true;
        email: true;
      };
    };
  };
}>;

@Injectable()
export class SyncService {
  private readonly queue: Queue<PedagogicalSyncJobPayload>;
  private readonly redis: Redis;
  private readonly logger = new Logger(SyncService.name);

  constructor(
    redisService: RedisService,
    private readonly prisma: PrismaService,
    private readonly projection: PedagogicalProjectionService,
    private readonly auditService: AuditService,
  ) {
    this.redis = redisService.getClient();
    this.queue = new Queue<PedagogicalSyncJobPayload>(PEDAGOGICAL_SYNC_QUEUE, {
      connection: this.redis,
    });
  }

  async enqueuePedagogicalSync(triggeredByUserId: string, requestId?: string | null) {
    return this.withEnqueueLock(async () => {
      await this.projection.recoverStaleRuns();
      const alreadyRunning = await this.hasSyncInFlight(false);
      if (alreadyRunning) {
        throw new ConflictException('Ja existe uma sincronizacao do pedagogico em andamento.');
      }

      const job = await this.queue.add(
        PEDAGOGICAL_SYNC_JOB,
        {
          triggeredByUserId,
          mode: 'manual',
        },
        PEDAGOGICAL_SYNC_JOB_OPTIONS,
      );

      await this.auditService.record({
        actorId: triggeredByUserId,
        actorType: 'user',
        action: 'sync.pedagogical.run',
        resourceType: 'queue_job',
        resourceId: String(job.id),
        requestId,
        metadata: {
          queue: PEDAGOGICAL_SYNC_QUEUE,
          jobName: PEDAGOGICAL_SYNC_JOB,
        },
      });

      return {
        jobId: String(job.id),
        status: 'queued',
      };
    });
  }

  async getOverview(): Promise<SyncOverview> {
    await this.projection.recoverStaleRuns();
    const [lastRun, lastSuccessfulRun, activeRun, openIssues] = await Promise.all([
      this.prisma.pedagogicalSyncRun.findFirst({
        orderBy: {
          startedAt: 'desc',
        },
        include: {
          issues: {
            select: {
              id: true,
            },
          },
          triggeredByUser: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      this.prisma.pedagogicalSyncRun.findFirst({
        where: {
          status: 'SUCCESS',
        },
        orderBy: {
          finishedAt: 'desc',
        },
        include: {
          issues: {
            select: {
              id: true,
            },
          },
          triggeredByUser: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      this.prisma.pedagogicalSyncRun.findFirst({
        where: {
          status: {
            in: ['PENDING', 'RUNNING'],
          },
        },
        orderBy: {
          startedAt: 'desc',
        },
        include: {
          issues: {
            select: {
              id: true,
            },
          },
          triggeredByUser: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      this.prisma.pedagogicalIssueState.count({
        where: {
          resolvedAt: null,
        },
      }),
    ]);

    return {
      lastRun: lastRun ? this.toSyncRunListItem(lastRun) : null,
      lastSuccessfulRun: lastSuccessfulRun ? this.toSyncRunListItem(lastSuccessfulRun) : null,
      activeRun: activeRun ? this.toSyncRunListItem(activeRun) : null,
      openIssues,
    };
  }

  async listRuns(query: QuerySyncRunsDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.from || query.to
        ? {
            startedAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const [runs, total] = await Promise.all([
      this.prisma.pedagogicalSyncRun.findMany({
        where,
        orderBy: {
          startedAt: 'desc',
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          issues: {
            select: {
              id: true,
            },
          },
          triggeredByUser: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      this.prisma.pedagogicalSyncRun.count({ where }),
    ]);

    return buildPaginatedResponse(
      runs.map((run) => this.toSyncRunListItem(run)),
      page,
      pageSize,
      total,
    );
  }

  async getRunDetail(id: string): Promise<SyncRunDetail> {
    const run = await this.prisma.pedagogicalSyncRun.findUnique({
      where: { id },
      include: {
        issues: true,
        triggeredByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!run) {
      throw new NotFoundException('Execucao de sync nao encontrada.');
    }

    return {
      ...this.toSyncRunListItem(run),
      issues: run.issues.map((issue) => this.toSyncIssueItem(issue)),
    };
  }

  async listIssueStates(query: QuerySyncIssueStatesDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = {
      ...(query.status === 'open'
        ? {
            resolvedAt: null,
          }
        : {}),
      ...(query.status === 'resolved'
        ? {
            resolvedAt: {
              not: null,
            },
          }
        : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.code ? { code: query.code } : {}),
      ...(query.resolutionType ? { resolutionType: query.resolutionType } : {}),
      ...(query.from || query.to
        ? {
            openedAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const [issueStates, total] = await Promise.all([
      this.prisma.pedagogicalIssueState.findMany({
        where,
        orderBy:
          query.status === 'resolved'
            ? {
                resolvedAt: 'desc',
              }
            : {
                lastSeenAt: 'desc',
              },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.pedagogicalIssueState.count({ where }),
    ]);

    return buildPaginatedResponse(
      issueStates.map((issueState) => this.toSyncIssueStateItem(issueState)),
      page,
      pageSize,
      total,
    );
  }

  async resolveIssueState(
    id: string,
    actorUserId: string,
    note?: string | null,
    requestId?: string | null,
  ) {
    await this.prisma.$transaction(async (tx) => {
      const issueState = await tx.pedagogicalIssueState.findUnique({
        where: { id },
      });

      if (!issueState) {
        throw new NotFoundException('Pendencia operacional nao encontrada.');
      }

      if (issueState.resolvedAt) {
        throw new ConflictException('Pendencia operacional ja resolvida.');
      }

      await tx.pedagogicalIssueState.update({
        where: { id },
        data: {
          resolvedAt: new Date(),
          resolutionType: 'MANUAL',
          resolutionNote: note?.trim() || null,
          resolvedByUserId: actorUserId,
          resolvedByRunId: null,
        },
      });

      await this.auditService.record(
        {
          actorId: actorUserId,
          actorType: 'user',
          action: 'sync.pedagogical.issue.resolved',
          resourceType: 'pedagogical_issue_state',
          resourceId: id,
          requestId,
          metadata: {
            resolutionType: 'MANUAL',
            note: note?.trim() || null,
          },
        },
        tx,
      );
    });

    const issueState = await this.prisma.pedagogicalIssueState.findUnique({
      where: { id },
    });

    if (!issueState) {
      throw new NotFoundException('Pendencia operacional nao encontrada.');
    }

    return this.toSyncIssueStateItem(issueState);
  }

  async executePedagogicalSync(
    triggeredByUserId?: string | null,
    mode: PedagogicalSyncJobPayload['mode'] = 'manual',
  ) {
    await this.projection.recoverStaleRuns();
    return this.projection.runFullSync(triggeredByUserId, mode);
  }

  async hasSyncInFlight(shouldRecoverStaleRuns = true) {
    if (shouldRecoverStaleRuns) {
      await this.projection.recoverStaleRuns();
    }
    const [runningRuns, jobCounts, leaseToken] = await Promise.all([
      this.prisma.pedagogicalSyncRun.count({
        where: {
          status: {
            in: ['PENDING', 'RUNNING'],
          },
        },
      }),
      this.queue.getJobCounts(...PEDAGOGICAL_SYNC_IN_FLIGHT_JOB_STATES),
      this.redis.get(PEDAGOGICAL_SYNC_LEASE_KEY),
    ]);

    const queuedJobs = Object.values(jobCounts).reduce((total, count) => total + count, 0);
    const leaseHeld = Boolean(leaseToken);

    if (queuedJobs > 0 && runningRuns > 0) {
      this.logger.warn(
        `Detected ${queuedJobs} queued sync jobs while ${runningRuns} run(s) are marked as RUNNING.`,
      );
    }

    return runningRuns > 0 || queuedJobs > 0 || leaseHeld;
  }

  private async withEnqueueLock<T>(operation: () => Promise<T>) {
    const lockToken = `${Date.now()}:${Math.random().toString(16).slice(2)}`;
    const acquired = await this.redis.set(
      PEDAGOGICAL_SYNC_ENQUEUE_LOCK_KEY,
      lockToken,
      'PX',
      PEDAGOGICAL_SYNC_ENQUEUE_LOCK_TTL_MS,
      'NX',
    );

    if (acquired !== 'OK') {
      throw new ConflictException('Ja existe uma requisicao de sync sendo processada.');
    }

    try {
      return await operation();
    } finally {
      await this.redis.eval(
        `
          if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
          end
          return 0
        `,
        1,
        PEDAGOGICAL_SYNC_ENQUEUE_LOCK_KEY,
        lockToken,
      );
    }
  }

  private toSyncRunListItem(run: SyncRunWithSummary): SyncRunListItem {
    return {
      id: run.id,
      mode: run.mode,
      status: run.status,
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt?.toISOString() ?? null,
      summary: toRecord(run.summary),
      issueCount: run.issues.length,
      triggeredByUser: run.triggeredByUser
        ? {
            id: run.triggeredByUser.id,
            name: run.triggeredByUser.name,
            email: run.triggeredByUser.email,
          }
        : null,
    };
  }

  private toSyncIssueItem(issue: SyncRunWithDetail['issues'][number]): SyncIssueItem {
    return {
      id: issue.id,
      entityType: issue.entityType,
      entitySourceId: issue.entitySourceId ?? null,
      severity: issue.severity,
      code: issue.code,
      message: issue.message,
      metadata: toRecord(issue.metadata),
      createdAt: issue.createdAt.toISOString(),
    };
  }

  private toSyncIssueStateItem(
    issueState: Prisma.PedagogicalIssueStateGetPayload<Record<string, never>>,
  ): SyncIssueStateItem {
    return {
      id: issueState.id,
      fingerprint: issueState.fingerprint,
      entityType: issueState.entityType,
      entitySourceId: issueState.entitySourceId ?? null,
      code: issueState.code,
      severity: issueState.severity,
      message: issueState.message,
      metadata: toRecord(issueState.metadata),
      status: issueState.resolvedAt ? 'resolved' : 'open',
      openedAt: issueState.openedAt.toISOString(),
      lastSeenAt: issueState.lastSeenAt.toISOString(),
      resolvedAt: issueState.resolvedAt?.toISOString() ?? null,
      resolutionType: issueState.resolutionType as SyncIssueResolutionType | null,
      resolutionNote: issueState.resolutionNote ?? null,
      resolvedByUserId: issueState.resolvedByUserId ?? null,
      openedByRunId: issueState.openedByRunId,
      lastSeenByRunId: issueState.lastSeenByRunId,
      resolvedByRunId: issueState.resolvedByRunId ?? null,
    };
  }
}
