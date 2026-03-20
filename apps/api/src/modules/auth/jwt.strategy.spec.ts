import { JwtStrategy } from './jwt.strategy';

const expectedNavigation = {
  items: [],
  areas: ['BACKOFFICE'] as const,
  defaultPath: '/backoffice',
};

describe('JwtStrategy', () => {
  it('returns false when the session is not active', async () => {
    const strategy = new JwtStrategy({
      session: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    } as never, {
      getClient: () => ({
        get: jest.fn().mockResolvedValue(null),
        del: jest.fn(),
        set: jest.fn(),
      }),
    } as never);

    await expect(
      strategy.validate({
        sub: 'user-1',
        email: 'owner@financial.test',
        sessionId: 'session-1',
        roles: ['owner'],
        permissions: ['companies.read'],
        areas: ['BACKOFFICE'],
        mustChangePassword: false,
      }),
    ).resolves.toBe(false);
  });

  it('returns roles and permissions resolved from the persisted session user', async () => {
    const redisGet = jest.fn().mockResolvedValue(null);
    const redisSet = jest.fn().mockResolvedValue('OK');
    const strategy = new JwtStrategy({
      session: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'session-1',
          expiresAt: new Date(Date.now() + 60_000),
          user: {
            id: 'user-1',
            name: 'Owner',
            email: 'owner@financial.test',
            status: 'ACTIVE',
            mfaEnabled: false,
            lockReason: null,
            lockedUntil: null,
            roles: [
              {
                role: {
                  name: 'owner',
                  isActive: true,
                  scope: 'BACKOFFICE',
                  permissions: [
                    {
                      permission: {
                        name: 'companies.read',
                        isActive: true,
                        scope: 'BACKOFFICE',
                        screens: [],
                      },
                    },
                    {
                      permission: {
                        name: 'audit.read',
                        isActive: true,
                        scope: 'BACKOFFICE',
                        screens: [],
                      },
                    },
                  ],
                },
              },
            ],
            mustChangePassword: false,
          },
        }),
      },
    } as never, {
      getClient: () => ({
        get: redisGet,
        del: jest.fn(),
        set: redisSet,
      }),
    } as never);

    await expect(
      strategy.validate({
        sub: 'user-1',
        email: 'owner@financial.test',
        sessionId: 'session-1',
        roles: ['owner'],
        permissions: ['companies.read'],
        areas: ['BACKOFFICE'],
        mustChangePassword: false,
      }),
    ).resolves.toEqual({
      id: 'user-1',
      name: 'Owner',
      email: 'owner@financial.test',
      sessionId: 'session-1',
      status: 'ACTIVE',
      mfaEnabled: false,
      roles: ['owner'],
      permissions: ['companies.read', 'audit.read'],
      areas: ['BACKOFFICE'],
      mustChangePassword: false,
      defaultPath: '/backoffice',
      lockReason: null,
      lockedUntil: null,
      navigation: expectedNavigation,
    });
    expect(redisGet).toHaveBeenCalledWith('session:session-1');
    expect(redisSet).toHaveBeenCalled();
  });

  it('uses the cached auth context when the session cache is warm', async () => {
    const findFirst = jest.fn();
    const strategy = new JwtStrategy({
      session: {
        findFirst,
      },
    } as never, {
      getClient: () => ({
        get: jest.fn().mockResolvedValue(
          JSON.stringify({
            sessionId: 'session-1',
            userId: 'user-1',
            name: 'Owner',
            email: 'owner@financial.test',
            status: 'ACTIVE',
            mfaEnabled: false,
            roles: ['owner'],
            permissions: ['companies.read'],
            areas: ['BACKOFFICE'],
            mustChangePassword: false,
            defaultPath: '/backoffice',
            lockReason: null,
            lockedUntil: null,
            navigation: expectedNavigation,
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
          }),
        ),
        del: jest.fn(),
        set: jest.fn(),
      }),
    } as never);

    await expect(
      strategy.validate({
        sub: 'user-1',
        email: 'owner@financial.test',
        sessionId: 'session-1',
        roles: ['owner'],
        permissions: ['companies.read'],
        areas: ['BACKOFFICE'],
        mustChangePassword: false,
      }),
    ).resolves.toEqual({
      id: 'user-1',
      name: 'Owner',
      email: 'owner@financial.test',
      sessionId: 'session-1',
      status: 'ACTIVE',
      mfaEnabled: false,
      roles: ['owner'],
      permissions: ['companies.read'],
      areas: ['BACKOFFICE'],
      mustChangePassword: false,
      defaultPath: '/backoffice',
      lockReason: null,
      lockedUntil: null,
      navigation: expectedNavigation,
    });
    expect(findFirst).not.toHaveBeenCalled();
  });
});
