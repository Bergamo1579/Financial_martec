import argon2 from 'argon2';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  it('returns secure cookie defaults for access and refresh tokens', () => {
    const service = new AuthService(
      {} as never,
      new JwtService(),
      {
        getClient: () => ({
          del: jest.fn(),
          set: jest.fn(),
        }),
      } as never,
      {
        record: jest.fn(),
      } as never,
    );

    expect(service.getAccessCookieName()).toBe('fm_access_token');
    expect(service.getRefreshCookieName()).toBe('fm_refresh_token');
    expect(service.getAccessCookieConfig()).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    });
    expect(service.getRefreshCookieConfig()).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    });
  });

  it('lists sessions with current and expired states normalized for the frontend', async () => {
    const prisma = {
      session: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'current-session',
            userAgent: 'Browser A',
            ipAddress: '127.0.0.1',
            createdAt: new Date('2026-03-18T08:00:00.000Z'),
            updatedAt: new Date('2026-03-18T08:10:00.000Z'),
            expiresAt: new Date(Date.now() + 60_000),
            lastUsedAt: new Date('2026-03-18T08:09:00.000Z'),
            revokedAt: null,
            status: 'ACTIVE',
          },
          {
            id: 'expired-session',
            userAgent: 'Browser B',
            ipAddress: '127.0.0.2',
            createdAt: new Date('2026-03-17T08:00:00.000Z'),
            updatedAt: new Date('2026-03-17T08:10:00.000Z'),
            expiresAt: new Date(Date.now() - 60_000),
            lastUsedAt: null,
            revokedAt: null,
            status: 'ACTIVE',
          },
        ]),
      },
    };
    const service = new AuthService(
      prisma as never,
      new JwtService(),
      {
        getClient: () => ({
          del: jest.fn(),
          set: jest.fn(),
        }),
      } as never,
      {
        record: jest.fn(),
      } as never,
    );

    const sessions = await service.listSessions({
      id: 'user-1',
      email: 'owner@financial.test',
      sessionId: 'current-session',
      roles: ['owner'],
      permissions: ['companies.read'],
    });

    expect(sessions).toEqual([
      expect.objectContaining({
        id: 'current-session',
        current: true,
        status: 'ACTIVE',
      }),
      expect.objectContaining({
        id: 'expired-session',
        current: false,
        status: 'EXPIRED',
      }),
    ]);
  });

  it('changes password and revokes all other active sessions', async () => {
    const passwordHash = await argon2.hash('CurrentPass123!', {
      type: argon2.argon2id,
    });
    const transactionClient = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          status: 'ACTIVE',
        }),
        update: jest.fn().mockResolvedValue(undefined),
      },
      session: {
        findMany: jest.fn().mockResolvedValue([{ id: 'other-session' }]),
        updateMany: jest
          .fn<Promise<void>, [{ where: { userId: string } }]>()
          .mockResolvedValue(undefined),
      },
    };
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          name: 'Owner',
          email: 'owner@financial.test',
          passwordHash,
          status: 'ACTIVE',
          mfaEnabled: false,
          roles: [
            {
              role: {
                name: 'owner',
                permissions: [
                  {
                    permission: { name: 'companies.read' },
                  },
                ],
              },
            },
          ],
        }),
      },
      $transaction: jest.fn().mockImplementation(async (callback: (tx: typeof transactionClient) => Promise<unknown>) =>
        callback(transactionClient)),
    };
    const redisDel = jest.fn().mockResolvedValue(undefined);
    const auditRecord = jest.fn().mockResolvedValue(undefined);
    const service = new AuthService(
      prisma as never,
      new JwtService(),
      {
        getClient: () => ({
          del: redisDel,
          set: jest.fn(),
        }),
      } as never,
      {
        record: auditRecord,
      } as never,
    );

    const result = await service.changePassword(
      {
        id: 'user-1',
        email: 'owner@financial.test',
        sessionId: 'current-session',
        roles: ['owner'],
        permissions: ['companies.read'],
      },
      {
        currentPassword: 'CurrentPass123!',
        newPassword: 'NewPass456!',
      },
      {
        headers: {},
        ip: '127.0.0.1',
        id: 'req-123',
      } as never,
    );

    expect(result).toEqual({
      message: 'Senha atualizada e outras sessoes revogadas.',
    });
    const updateManyArgs = transactionClient.session.updateMany.mock.calls[0]?.[0];
    expect(updateManyArgs?.where.userId).toBe('user-1');
    expect(redisDel).toHaveBeenCalledWith('session:other-session');
    expect(auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth.password.changed',
        requestId: 'req-123',
      }),
      transactionClient,
    );
  });
});
