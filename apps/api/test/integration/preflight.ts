import { Prisma, PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import {
  assertSafeIntegrationTestTargets,
  parsePostgresTarget,
  parseRedisTarget,
} from '../../src/common/lib/integration-test-env';

let preflightPromise: Promise<void> | null = null;

export async function runIntegrationPreflight() {
  if (!preflightPromise) {
    preflightPromise = validateIntegrationInfrastructure();
  }

  return preflightPromise;
}

async function validateIntegrationInfrastructure() {
  const runtimeDatabaseUrl = process.env.RUNTIME_DATABASE_URL?.trim() || process.env.DATABASE_URL;
  const runtimeRedisUrl = process.env.RUNTIME_REDIS_URL?.trim() || process.env.REDIS_URL;
  const databaseTestUrl = process.env.DATABASE_TEST_URL?.trim();
  const redisTestUrl = process.env.REDIS_TEST_URL?.trim();

  if (!runtimeDatabaseUrl || !runtimeRedisUrl || !databaseTestUrl || !redisTestUrl) {
    throw new Error('Integration preflight requer DATABASE_TEST_URL, REDIS_TEST_URL e URLs de runtime resolvidas.');
  }

  assertSafeIntegrationTestTargets(runtimeDatabaseUrl, runtimeRedisUrl, {
    databaseUrl: databaseTestUrl,
    redisUrl: redisTestUrl,
  });

  const postgresTarget = parsePostgresTarget(databaseTestUrl);
  const redisTarget = parseRedisTarget(redisTestUrl);

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: databaseTestUrl,
      },
    },
  });
  const redis = new Redis(redisTestUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });

  try {
    await prisma.$connect();
    const [{ schemaExists }] = await prisma.$queryRaw<Array<{ schemaExists: boolean }>>(
      Prisma.sql`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.schemata
          WHERE schema_name = ${postgresTarget.schema}
        ) AS "schemaExists"
      `,
    );
    const [{ migrationsTableExists }] = await prisma.$queryRaw<Array<{ migrationsTableExists: boolean }>>(
      Prisma.sql`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = ${postgresTarget.schema}
            AND table_name = '_prisma_migrations'
        ) AS "migrationsTableExists"
      `,
    );

    if (!schemaExists || !migrationsTableExists) {
      throw new Error(
        `Integration preflight nao encontrou o schema de integracao "${postgresTarget.schema}" pronto para uso.`,
      );
    }

    await redis.connect();
    await redis.ping();

    const selectedDb = await redis.call('CLIENT', 'INFO');
    if (typeof selectedDb !== 'string' || !selectedDb.includes(`db=${redisTarget.db}`)) {
      throw new Error(
        `Integration preflight conectou em um DB Redis diferente do esperado (${redisTarget.db}).`,
      );
    }
  } catch (error) {
    throw new Error(
      `Falha no preflight da suite integrada: ${error instanceof Error ? error.message : 'erro desconhecido'}`,
    );
  } finally {
    await prisma.$disconnect();
    redis.disconnect();
  }
}

if (require.main === module) {
  runIntegrationPreflight()
    .then(() => {
      console.log('Integration preflight completed successfully.');
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : 'Integration preflight failed.');
      process.exit(1);
    });
}
