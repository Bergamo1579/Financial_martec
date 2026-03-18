import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type {
  AppPermission,
  AppRole,
  AuthenticatedUser,
} from '@financial-martec/contracts';
import type { Request } from 'express';
import { env } from '@/common/config/env';
import { PrismaService } from '@/common/prisma/prisma.service';
import { RedisService } from '@/common/redis/redis.service';
import type { JwtPayload } from './auth.types';
import {
  buildSessionCacheKey,
  type CachedSessionAuthContext,
  toAuthenticatedUser,
} from './auth-session-cache';

function cookieExtractor(request: Request) {
  return (request.cookies?.fm_access_token as string | undefined) ?? null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: env.JWT_ACCESS_SECRET,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser | false> {
    const cachedContext = await this.readCachedSession(payload.sessionId, payload.sub);
    if (cachedContext) {
      return toAuthenticatedUser(cachedContext);
    }

    const session = await this.prisma.session.findFirst({
      where: {
        id: payload.sessionId,
        userId: payload.sub,
        status: 'ACTIVE',
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        user: {
          include: {
            roles: {
              include: {
                role: {
                  include: {
                    permissions: {
                      include: {
                        permission: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!session || session.user.status !== 'ACTIVE') {
      return false;
    }

    const authenticatedUser = {
      id: session.user.id,
      email: session.user.email,
      sessionId: session.id,
      roles: session.user.roles.map((userRole) => userRole.role.name as AppRole),
      permissions: [
        ...new Set(
          session.user.roles.flatMap((userRole) =>
            userRole.role.permissions.map(
              (rolePermission) => rolePermission.permission.name as AppPermission,
            ),
          ),
        ),
      ],
    } satisfies AuthenticatedUser;

    await this.writeCachedSession({
      sessionId: session.id,
      userId: session.user.id,
      email: session.user.email,
      status: session.user.status,
      roles: authenticatedUser.roles,
      permissions: authenticatedUser.permissions,
      expiresAt: session.expiresAt.toISOString(),
    });

    return authenticatedUser;
  }

  private async readCachedSession(sessionId: string, userId: string) {
    const cache = await this.redis.getClient().get(buildSessionCacheKey(sessionId));
    if (!cache) {
      return null;
    }

    try {
      const parsed = JSON.parse(cache) as CachedSessionAuthContext;
      const expiresAt = new Date(parsed.expiresAt);
      if (
        parsed.sessionId !== sessionId ||
        parsed.userId !== userId ||
        parsed.status !== 'ACTIVE' ||
        Number.isNaN(expiresAt.getTime()) ||
        expiresAt <= new Date()
      ) {
        await this.redis.getClient().del(buildSessionCacheKey(sessionId));
        return null;
      }

      return parsed;
    } catch {
      await this.redis.getClient().del(buildSessionCacheKey(sessionId));
      return null;
    }
  }

  private async writeCachedSession(cachedContext: CachedSessionAuthContext) {
    const ttlSeconds = Math.max(
      1,
      Math.ceil((new Date(cachedContext.expiresAt).getTime() - Date.now()) / 1_000),
    );
    await this.redis
      .getClient()
      .set(
        buildSessionCacheKey(cachedContext.sessionId),
        JSON.stringify(cachedContext),
        'EX',
        ttlSeconds,
      );
  }
}
