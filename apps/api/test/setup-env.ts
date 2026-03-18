import {
  assertSafeIntegrationTestTargets,
  resolveIntegrationTestTargets,
} from '../src/common/lib/integration-test-env';

process.env.NODE_ENV = 'test';
process.env.APP_PORT = '4000';
process.env.APP_URL = 'http://localhost:4000';
process.env.CORS_ORIGIN = 'http://localhost:3000';
process.env.RUNTIME_DATABASE_URL =
  process.env.RUNTIME_DATABASE_URL?.trim() ||
  process.env.DATABASE_URL?.trim() ||
  'postgresql://postgres:postgres@localhost:5432/financial_martec?schema=public';
process.env.RUNTIME_REDIS_URL =
  process.env.RUNTIME_REDIS_URL?.trim() ||
  process.env.REDIS_URL?.trim() ||
  'redis://localhost:6379/0';
const integrationTargets = resolveIntegrationTestTargets(process.env);

assertSafeIntegrationTestTargets(
  process.env.RUNTIME_DATABASE_URL,
  process.env.RUNTIME_REDIS_URL,
  integrationTargets,
);

process.env.DATABASE_TEST_URL = integrationTargets.databaseUrl;
process.env.REDIS_TEST_URL = integrationTargets.redisUrl;
process.env.DATABASE_URL = integrationTargets.databaseUrl;
process.env.REDIS_URL = integrationTargets.redisUrl;
process.env.JWT_ACCESS_SECRET = 'test-access-secret-123456';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-123456';
process.env.INTERNAL_SYNC_SECRET = 'test-internal-secret-123456';
process.env.PEDAGOGICAL_API_BASE_URL = 'https://api.oriztech.com';
process.env.PEDAGOGICAL_USERNAME = 'pedagogical-user';
process.env.PEDAGOGICAL_PASSWORD = 'pedagogical-pass';
process.env.PEDAGOGICAL_REQUEST_TIMEOUT_MS = '30000';
