import 'dotenv/config';
import { Queue, Worker } from 'bullmq';
import { CronJob } from 'cron';
import pino from 'pino';
import Redis from 'ioredis';
import {
  PEDAGOGICAL_SYNC_JOB,
  PEDAGOGICAL_SYNC_QUEUE,
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
  INTERNAL_SYNC_SECRET: z.string().min(16),
});

const env = envSchema.parse(process.env);
const logger = pino({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
});

const connection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

const queue = new Queue(PEDAGOGICAL_SYNC_QUEUE, {
  connection,
});

async function executeSync() {
  const response = await fetch(
    `${env.WORKER_API_BASE_URL}/v1/sync/internal/pedagogical/execute`,
    {
      method: 'POST',
      headers: {
        'x-internal-sync-secret': env.INTERNAL_SYNC_SECRET,
      },
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Sync execution failed (${response.status}): ${body}`);
  }

  return response.json();
}

const worker = new Worker(
  PEDAGOGICAL_SYNC_QUEUE,
  async (job) => {
    logger.info({ jobId: job.id, jobName: job.name }, 'processing sync job');
    return executeSync();
  },
  {
    connection,
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
    const job = await queue.add(
      PEDAGOGICAL_SYNC_JOB,
      {
        triggeredByUserId: null,
      },
      {
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    );

    logger.info({ jobId: job.id }, 'scheduled daily sync job');
  },
  start: true,
});

async function bootstrap() {
  logger.info('financial worker booting');

  if (env.WORKER_SYNC_ON_STARTUP) {
    const job = await queue.add(
      PEDAGOGICAL_SYNC_JOB,
      {
        triggeredByUserId: null,
      },
      {
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    );

    logger.info({ jobId: job.id }, 'startup sync job enqueued');
  }

  process.on('SIGINT', async () => {
    dailyJob.stop();
    await worker.close();
    await queue.close();
    await connection.quit();
    process.exit(0);
  });
}

void bootstrap();
