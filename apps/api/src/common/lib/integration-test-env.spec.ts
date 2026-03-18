import {
  assertSafeIntegrationTestTargets,
  parsePostgresTarget,
  parseRedisTarget,
  resolveIntegrationTestTargets,
} from './integration-test-env';

describe('integration-test-env', () => {
  it('uses dedicated local defaults when explicit test URLs are not provided', () => {
    expect(resolveIntegrationTestTargets({})).toEqual({
      databaseUrl:
        'postgresql://postgres:postgres@localhost:5432/financial_martec?schema=api_integration',
      redisUrl: 'redis://localhost:6379/15',
    });
  });

  it('parses postgres and redis runtime targets', () => {
    expect(
      parsePostgresTarget('postgresql://user:pass@db.internal:5432/financial_martec?schema=api_integration'),
    ).toEqual({
      host: 'db.internal',
      port: '5432',
      database: 'financial_martec',
      schema: 'api_integration',
    });
    expect(parseRedisTarget('redis://default:secret@redis.internal:4001/15')).toEqual({
      host: 'redis.internal',
      port: '4001',
      db: 15,
    });
  });

  it('rejects test targets that overlap the runtime schema or redis DB', () => {
    expect(() =>
      assertSafeIntegrationTestTargets(
        'postgresql://user:pass@db.internal:5432/financial_martec?schema=public',
        'redis://default:secret@redis.internal:4001/0',
        {
          databaseUrl:
            'postgresql://user:pass@db.internal:5432/financial_martec?schema=public',
          redisUrl: 'redis://default:secret@redis.internal:4001/0',
        },
      ),
    ).toThrow('DATABASE_TEST_URL');
  });
});
