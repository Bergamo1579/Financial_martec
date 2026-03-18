import 'dotenv/config';
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import { Queue, Worker } from 'bullmq';
import { CronJob } from 'cron';
import pino from 'pino';
import Redis from 'ioredis';
import {
  PEDAGOGICAL_SYNC_ENQUEUE_LOCK_KEY,
  PEDAGOGICAL_SYNC_ENQUEUE_LOCK_TTL_MS,
  PEDAGOGICAL_SYNC_JOB,
  PEDAGOGICAL_SYNC_IN_FLIGHT_JOB_STATES,
  PEDAGOGICAL_SYNC_JOB_OPTIONS,
  PEDAGOGICAL_SYNC_LEASE_KEY,
  PEDAGOGICAL_SYNC_QUEUE,
  type PedagogicalSyncJobPayload,
} from '@financial-martec/contracts';
import { z } from 'zod';

const envSchema = z.object({
  REDIS_URL: z.string().min(1),
  WORKER_API_BASE_URL: z.string().url(),
  WORKER_DAILY_SYNC_CRON: z.string().default('0 3 * * *'),
  WORKER_SYNC_ON_STARTUP: z
    .string()
    .optional()
    .transform((value) => value === 'true'),
  WORKER_SYNC_REQUEST_TIMEOUT_MS: z.coerce.number().default(15 * 60 * 1000),
  WORKER_HEALTH_HOST: z.string().default('0.0.0.0'),
  WORKER_HEALTH_PORT: z.coerce.number().int().min(1).max(65535).default(4010),
  INTERNAL_SYNC_SECRET: z.string().min(16),
});

const env = envSchema.parse(process.env);
const logger = pino({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
});

const connection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

const queue = new Queue<PedagogicalSyncJobPayload>(PEDAGOGICAL_SYNC_QUEUE, {
  connection,
});
let shuttingDown = false;
let shutdownPromise: Promise<void> | null = null;
let healthServer: Server | null = null;

async function hasSyncInFlight() {
  const [jobCounts, leaseToken] = await Promise.all([
    queue.getJobCounts(...PEDAGOGICAL_SYNC_IN_FLIGHT_JOB_STATES),
    connection.get(PEDAGOGICAL_SYNC_LEASE_KEY),
  ]);

  return Object.values(jobCounts).some((count) => count > 0) || Boolean(leaseToken);
}

async function enqueueSystemSync(mode: 'schedule' | 'startup') {
  const lockToken = `${Date.now()}:${Math.random().toString(16).slice(2)}`;
  const acquired = await connection.set(
    PEDAGOGICAL_SYNC_ENQUEUE_LOCK_KEY,
    lockToken,
    'PX',
    PEDAGOGICAL_SYNC_ENQUEUE_LOCK_TTL_MS,
    'NX',
  );

  if (acquired !== 'OK') {
    logger.info({ mode }, 'sync enqueue skipped because another enqueue is already in progress');
    return null;
  }

  try {
    if (await hasSyncInFlight()) {
      logger.info({ mode }, 'sync job skipped because another sync is already queued or running');
      return null;
    }

    const job = await queue.add(
      PEDAGOGICAL_SYNC_JOB,
      {
        triggeredByUserId: null,
        mode,
      },
      PEDAGOGICAL_SYNC_JOB_OPTIONS,
    );

    return job;
  } finally {
    await connection.eval(
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

async function executeSync(payload: PedagogicalSyncJobPayload) {
  let response: Response;
  try {
    response = await fetch(
      `${env.WORKER_API_BASE_URL}/v1/sync/internal/pedagogical/execute`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-internal-sync-secret': env.INTERNAL_SYNC_SECRET,
        },
        signal: AbortSignal.timeout(env.WORKER_SYNC_REQUEST_TIMEOUT_MS),
        body: JSON.stringify({
          triggeredByUserId: payload.triggeredByUserId,
          mode: payload.mode,
        }),
      },
    );
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === 'TimeoutError' || error.name === 'AbortError')
    ) {
      throw new Error(
        `Sync execution timed out after ${env.WORKER_SYNC_REQUEST_TIMEOUT_MS}ms.`,
      );
    }

    throw error;
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Sync execution failed (${response.status}): ${body}`);
  }

  return response.json();
}

function respondJson(
  response: ServerResponse<IncomingMessage>,
  statusCode: number,
  body: Record<string, unknown>,
) {
  response.writeHead(statusCode, {
    'content-type': 'application/json',
  });
  response.end(JSON.stringify(body));
}

async function handleHealthRequest(
  request: IncomingMessage,
  response: ServerResponse<IncomingMessage>,
) {
  const url = new URL(request.url ?? '/', 'http://worker.local');

  if (url.pathname === '/health/live') {
    respondJson(response, 200, {
      status: shuttingDown ? 'shutting_down' : 'ok',
      service: 'financial-martec-worker',
    });
    return;
  }

  if (url.pathname === '/health/ready') {
    if (shuttingDown) {
      respondJson(response, 503, {
        status: 'shutting_down',
        service: 'financial-martec-worker',
      });
      return;
    }

    try {
      await connection.ping();
      const jobCounts = await queue.getJobCounts(...PEDAGOGICAL_SYNC_IN_FLIGHT_JOB_STATES);
      respondJson(response, 200, {
        status: 'ready',
        service: 'financial-martec-worker',
        inFlightJobs: jobCounts,
      });
    } catch (error) {
      respondJson(response, 503, {
        status: 'not_ready',
        service: 'financial-martec-worker',
        error: error instanceof Error ? error.message : 'unknown',
      });
    }
    return;
  }

  respondJson(response, 404, {
    error: 'not_found',
  });
}

async function startHealthServer() {
  const server = createServer((request, response) => {
    void handleHealthRequest(request, response);
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(env.WORKER_HEALTH_PORT, env.WORKER_HEALTH_HOST, () => {
      server.off('error', reject);
      resolve();
    });
  });

  logger.info(
    {
      host: env.WORKER_HEALTH_HOST,
      port: env.WORKER_HEALTH_PORT,
    },
    'worker health server listening',
  );
  return server;
}

async function closeHealthServer(server: Server | null) {
  if (!server) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

async function shutdown(exitCode: number) {
  if (!shutdownPromise) {
    shuttingDown = true;
    shutdownPromise = (async () => {
      dailyJob.stop();
      await closeHealthServer(healthServer);
      await worker.close();
      await queue.close();
      await connection.quit();
    })();
  }

  try {
    await shutdownPromise;
  } finally {
    process.exit(exitCode);
  }
}

function registerProcessHandlers() {
  process.once('SIGINT', () => {
    void shutdown(0);
  });
  process.once('SIGTERM', () => {
    void shutdown(0);
  });
  process.once('unhandledRejection', (error) => {
    logger.error({ error }, 'unhandled rejection in worker process');
    void shutdown(1);
  });
  process.once('uncaughtException', (error) => {
    logger.error({ error }, 'uncaught exception in worker process');
    void shutdown(1);
  });
}

const worker = new Worker(
  PEDAGOGICAL_SYNC_QUEUE,
  async (job) => {
    logger.info({ jobId: job.id, jobName: job.name }, 'processing sync job');
    return executeSync(job.data);
  },
  {
    connection,
    concurrency: 1,
  },
);

worker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'sync job completed');
});

worker.on('failed', (job, error) => {
  logger.error({ jobId: job?.id, error }, 'sync job failed');
});

const dailyJob = CronJob.from({
  cronTime: env.WORKER_DAILY_SYNC_CRON,
  onTick: async () => {
    const job = await enqueueSystemSync('schedule');
    if (!job) {
      return;
    }

    logger.info({ jobId: job.id }, 'scheduled daily sync job');
  },
  start: true,
});

async function bootstrap() {
  logger.info('financial worker booting');
  healthServer = await startHealthServer();
  registerProcessHandlers();

  if (env.WORKER_SYNC_ON_STARTUP) {
    const job = await enqueueSystemSync('startup');
    if (job) {
      logger.info({ jobId: job.id }, 'startup sync job enqueued');
    }
  }
}

void bootstrap();
