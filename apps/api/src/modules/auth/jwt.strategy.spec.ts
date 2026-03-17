import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  it('returns false when the session is not active', async () => {
    const strategy = new JwtStrategy({
      session: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    } as never);

    await expect(
      strategy.validate({
        sub: 'user-1',
        email: 'owner@financial.test',
        sessionId: 'session-1',
        roles: ['owner'],
      }),
    ).resolves.toBe(false);
  });
});
