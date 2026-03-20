import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { env } from '@/common/config/env';
import { PrismaService } from '@/common/prisma/prisma.service';
import { RedisService } from '@/common/redis/redis.service';
import type { AuthenticatedUser, JwtPayload } from './auth.types';
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
                        permission: {
                          include: {
                            screens: {
                              include: {
                                screen: true,
                              },
                            },
                          },
                        },
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

    const roles = session.user.roles
      .filter((userRole) => userRole.role.isActive)
      .map((userRole) => userRole.role.name);
    const permissions = [
      ...new Set(
        session.user.roles
          .filter((userRole) => userRole.role.isActive)
          .flatMap((userRole) =>
            userRole.role.permissions
              .filter((rolePermission) => rolePermission.permission.isActive)
              .map((rolePermission) => rolePermission.permission.name),
          ),
      ),
    ];
    const permissionSet = new Set(permissions);
    const areas = [
      ...new Set(
        session.user.roles.flatMap((userRole) => {
          if (!userRole.role.isActive) {
            return [];
          }

          const resolvedAreas = new Set<'BACKOFFICE' | 'APP'>();
          if (userRole.role.scope === 'BACKOFFICE' || userRole.role.scope === 'BOTH') {
            resolvedAreas.add('BACKOFFICE');
          }
          if (userRole.role.scope === 'APP' || userRole.role.scope === 'BOTH') {
            resolvedAreas.add('APP');
          }

          for (const rolePermission of userRole.role.permissions) {
            if (!rolePermission.permission.isActive) {
              continue;
            }
            if (
              rolePermission.permission.scope === 'BACKOFFICE' ||
              rolePermission.permission.scope === 'BOTH'
            ) {
              resolvedAreas.add('BACKOFFICE');
            }
            if (
              rolePermission.permission.scope === 'APP' ||
              rolePermission.permission.scope === 'BOTH'
            ) {
              resolvedAreas.add('APP');
            }
            for (const permissionScreen of rolePermission.permission.screens ?? []) {
              if (permissionScreen.screen.isActive) {
                resolvedAreas.add(permissionScreen.screen.area as 'BACKOFFICE' | 'APP');
              }
            }
          }

          return [...resolvedAreas];
        }),
      ),
    ];

    const navigationMap = new Map<string, AuthenticatedUser['navigation']['items'][number]>();
    for (const userRole of session.user.roles) {
      if (!userRole.role.isActive) {
        continue;
      }

      for (const rolePermission of userRole.role.permissions) {
        if (!rolePermission.permission.isActive || !permissionSet.has(rolePermission.permission.name)) {
          continue;
        }

        for (const permissionScreen of rolePermission.permission.screens ?? []) {
          const screen = permissionScreen.screen;
          if (!screen.isActive) {
            continue;
          }

          const existing = navigationMap.get(screen.key);
          if (existing) {
            if (!existing.permissions.includes(rolePermission.permission.name)) {
              existing.permissions.push(rolePermission.permission.name);
            }
            continue;
          }

          navigationMap.set(screen.key, {
            key: screen.key,
            title: screen.title,
            path: screen.path,
            group: screen.group,
            area: screen.area as 'BACKOFFICE' | 'APP',
            permissions: [rolePermission.permission.name],
          });
        }
      }
    }

    const navigationItems = [...navigationMap.values()].sort((left, right) => {
      return (
        left.area.localeCompare(right.area) ||
        left.group.localeCompare(right.group) ||
        left.title.localeCompare(right.title)
      );
    });
    const defaultPath = session.user.mustChangePassword
      ? '/change-password'
      : areas.includes('BACKOFFICE')
        ? '/backoffice'
        : areas.includes('APP')
          ? '/app'
          : '/forbidden';

    const authenticatedUser = {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      sessionId: session.id,
      status: session.user.status,
      mfaEnabled: session.user.mfaEnabled,
      roles,
      permissions,
      areas,
      mustChangePassword: session.user.mustChangePassword,
      defaultPath,
      lockReason: session.user.lockReason,
      lockedUntil: session.user.lockedUntil?.toISOString() ?? null,
      navigation: {
        items: navigationItems,
        areas,
        defaultPath,
      },
    } satisfies AuthenticatedUser;

    await this.writeCachedSession({
      sessionId: session.id,
      userId: session.user.id,
      name: session.user.name,
      email: session.user.email,
      status: session.user.status,
      mfaEnabled: session.user.mfaEnabled,
      roles: authenticatedUser.roles,
      permissions: authenticatedUser.permissions,
      areas: authenticatedUser.areas,
      mustChangePassword: authenticatedUser.mustChangePassword,
      defaultPath: authenticatedUser.defaultPath,
      lockReason: authenticatedUser.lockReason,
      lockedUntil: authenticatedUser.lockedUntil,
      navigation: authenticatedUser.navigation,
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
