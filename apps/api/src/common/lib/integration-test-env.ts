type IntegrationTestTargets = {
  databaseUrl: string;
  redisUrl: string;
};

type PostgresTarget = {
  host: string;
  port: string;
  database: string;
  schema: string;
};

type RedisTarget = {
  host: string;
  port: string;
  db: number;
};

const DEFAULT_LOCAL_DATABASE_TEST_URL =
  'postgresql://postgres:postgres@localhost:5432/financial_martec?schema=api_integration';
const DEFAULT_LOCAL_REDIS_TEST_URL = 'redis://localhost:6379/15';
const REQUIRED_TEST_SCHEMA = 'api_integration';
const REQUIRED_TEST_REDIS_DB = 15;

function normalizeSchema(url: URL) {
  return url.searchParams.get('schema')?.trim() || 'public';
}

function normalizeRedisDb(url: URL) {
  const rawValue = url.pathname.replace('/', '').trim();
  if (!rawValue) {
    return 0;
  }

  const parsed = Number(rawValue);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function parsePostgresTarget(connectionString: string): PostgresTarget {
  const url = new URL(connectionString);

  return {
    host: url.hostname,
    port: url.port || '5432',
    database: url.pathname.replace('/', ''),
    schema: normalizeSchema(url),
  };
}

export function parseRedisTarget(connectionString: string): RedisTarget {
  const url = new URL(connectionString);

  return {
    host: url.hostname,
    port: url.port || '6379',
    db: normalizeRedisDb(url),
  };
}

export function resolveIntegrationTestTargets(
  source: NodeJS.ProcessEnv = process.env,
): IntegrationTestTargets {
  return {
    databaseUrl: source.DATABASE_TEST_URL?.trim() || DEFAULT_LOCAL_DATABASE_TEST_URL,
    redisUrl: source.REDIS_TEST_URL?.trim() || DEFAULT_LOCAL_REDIS_TEST_URL,
  };
}

export function assertSafeIntegrationTestTargets(
  runtimeDatabaseUrl: string,
  runtimeRedisUrl: string,
  testTargets: IntegrationTestTargets,
) {
  const runtimeDatabase = parsePostgresTarget(runtimeDatabaseUrl);
  const testDatabase = parsePostgresTarget(testTargets.databaseUrl);

  if (testDatabase.schema !== REQUIRED_TEST_SCHEMA) {
    throw new Error(
      `DATABASE_TEST_URL deve usar o schema "${REQUIRED_TEST_SCHEMA}". Valor recebido: "${testDatabase.schema}".`,
    );
  }

  if (
    runtimeDatabase.host === testDatabase.host &&
    runtimeDatabase.port === testDatabase.port &&
    runtimeDatabase.database === testDatabase.database &&
    runtimeDatabase.schema === testDatabase.schema
  ) {
    throw new Error(
      'DATABASE_TEST_URL nao pode apontar para o mesmo schema do runtime. Use um schema dedicado para integracao.',
    );
  }

  const runtimeRedis = parseRedisTarget(runtimeRedisUrl);
  const testRedis = parseRedisTarget(testTargets.redisUrl);

  if (testRedis.db !== REQUIRED_TEST_REDIS_DB) {
    throw new Error(
      `REDIS_TEST_URL deve usar o DB logico ${REQUIRED_TEST_REDIS_DB}. Valor recebido: ${testRedis.db}.`,
    );
  }

  if (
    runtimeRedis.host === testRedis.host &&
    runtimeRedis.port === testRedis.port &&
    runtimeRedis.db === testRedis.db
  ) {
    throw new Error(
      'REDIS_TEST_URL nao pode apontar para o mesmo DB logico do runtime. Use um DB dedicado para integracao.',
    );
  }
}
