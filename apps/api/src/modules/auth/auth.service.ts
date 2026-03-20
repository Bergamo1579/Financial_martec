import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, type Session, type User } from '@prisma/client';
import argon2 from 'argon2';
import { randomBytes } from 'crypto';
import type { Request } from 'express';
import type {
  AppArea,
  AppPermission,
  AppRole,
  AuthBootstrapResponse,
  AuthUserResponse,
  NavigationItem,
  NavigationResponse,
  SessionItem,
  SessionStatus,
} from '@financial-martec/contracts';
import { authCookieOptions, env } from '@/common/config/env';
import { sha256 } from '@/common/lib/hash.util';
import { getRequestId, getRequestIp } from '@/common/lib/request.util';
import { PrismaService } from '@/common/prisma/prisma.service';
import { RedisService } from '@/common/redis/redis.service';
import { AuditService } from '@/modules/audit/audit.service';
import type { AuthenticatedUser, JwtPayload } from './auth.types';
import {
  buildSessionCacheKey,
  type CachedSessionAuthContext,
} from './auth-session-cache';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';

const ACCESS_COOKIE_NAME = 'fm_access_token';
const REFRESH_COOKIE_NAME = 'fm_refresh_token';

type UserWithAccess = Prisma.UserGetPayload<{
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
                        screen: true;
                      };
                    };
                  };
                };
              };
            };
          };
        };
      };
    };
  };
}>;

type AuthResult = {
  sessionId: string;
  accessToken: string;
  refreshToken: string;
  user: AuthUserResponse;
};

type PasswordChangeMode = 'standard' | 'temporary';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly redis: RedisService,
    private readonly auditService: AuditService,
  ) {}

  getAccessCookieName() {
    return ACCESS_COOKIE_NAME;
  }

  getRefreshCookieName() {
    return REFRESH_COOKIE_NAME;
  }

  getAccessCookieConfig() {
    return {
      ...authCookieOptions,
      maxAge: env.ACCESS_TOKEN_TTL_MINUTES * 60 * 1000,
    };
  }

  getRefreshCookieConfig() {
    return {
      ...authCookieOptions,
      maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
    };
  }

  async login(dto: LoginDto, request: Request) {
    const identifier = dto.email.trim().toLowerCase();
    let user = await this.findUserWithAccessByEmail(identifier);

    if (user) {
      user = await this.releaseExpiredFailedAttemptLock(user);
      this.ensureUserCanAuthenticate(user);
    } else {
      await this.ensureUnknownIdentifierIsNotLocked(identifier);
    }

    const isPasswordValid = user && (await argon2.verify(user.passwordHash, dto.password));

    if (!user || !isPasswordValid) {
      await this.registerFailedAttempt(identifier, request, user ?? undefined);
      throw new UnauthorizedException('Credenciais invalidas.');
    }

    const authResult = await this.createSessionTokens(user, request);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
      },
    });

    await this.prisma.loginAttempt.create({
      data: {
        identifier,
        ipAddress: getRequestIp(request),
        succeeded: true,
        userId: user.id,
        metadata: {
          userAgent: request.headers['user-agent'],
        },
      },
    });

    await this.auditService.record({
      actorId: user.id,
      actorType: 'user',
      action: 'auth.login.success',
      resourceType: 'session',
      resourceId: authResult.sessionId,
      ipAddress: getRequestIp(request),
      requestId: getRequestId(request),
      metadata: {
        email: user.email,
        mustChangePassword: user.mustChangePassword,
      },
    });

    return authResult;
  }

  async refresh(refreshToken: string | undefined, request: Request) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token ausente.');
    }

    const session = await this.prisma.session.findUnique({
      where: {
        refreshTokenHash: sha256(refreshToken),
      },
      include: {
        user: {
          include: this.userAccessInclude(),
        },
      },
    });

    if (!session || session.status !== 'ACTIVE' || session.expiresAt <= new Date()) {
      throw new UnauthorizedException('Sessao invalida ou expirada.');
    }

    const user = await this.releaseExpiredFailedAttemptLock(session.user);
    this.ensureUserCanAuthenticate(user);

    const rotated = await this.rotateSession(session.id, user, request);

    await this.auditService.record({
      actorId: user.id,
      actorType: 'user',
      action: 'auth.refresh',
      resourceType: 'session',
      resourceId: session.id,
      ipAddress: getRequestIp(request),
      requestId: getRequestId(request),
      metadata: {
        email: user.email,
      },
    });

    return rotated;
  }

  async logout(user: AuthenticatedUser, requestId?: string | null) {
    await this.prisma.session.updateMany({
      where: {
        id: user.sessionId,
        userId: user.id,
      },
      data: {
        status: 'REVOKED',
        revokedAt: new Date(),
      },
    });

    await this.evictSessionCaches([user.sessionId]);

    await this.auditService.record({
      actorId: user.id,
      actorType: 'user',
      action: 'auth.logout',
      resourceType: 'session',
      resourceId: user.sessionId,
      requestId,
    });
  }

  getMe(user: AuthenticatedUser) {
    return this.toAuthUserResponse(user);
  }

  getBootstrap(user: AuthenticatedUser): AuthBootstrapResponse {
    return {
      user: this.toAuthUserResponse(user),
      navigation: user.navigation,
    };
  }

  getNavigation(user: AuthenticatedUser): NavigationResponse {
    return user.navigation;
  }

  async listSessions(user: AuthenticatedUser) {
    const sessions = await this.prisma.session.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return sessions.map((session) => this.buildSessionResponse(session, user.sessionId));
  }

  async revokeSession(user: AuthenticatedUser, sessionId: string, requestId?: string | null) {
    const session = await this.prisma.session.findFirst({
      where: {
        id: sessionId,
        userId: user.id,
      },
    });

    if (!session) {
      throw new NotFoundException('Sessao nao encontrada.');
    }

    if (session.status !== 'REVOKED') {
      await this.prisma.session.update({
        where: { id: session.id },
        data: {
          status: 'REVOKED',
          revokedAt: new Date(),
        },
      });
    }

    await this.evictSessionCaches([session.id]);

    await this.auditService.record({
      actorId: user.id,
      actorType: 'user',
      action: 'auth.session.revoked',
      resourceType: 'session',
      resourceId: session.id,
      requestId,
    });
  }

  async changePassword(user: AuthenticatedUser, dto: ChangePasswordDto, request: Request) {
    return this.updatePassword(user, dto, request, 'standard');
  }

  async changeTemporaryPassword(
    user: AuthenticatedUser,
    dto: ChangePasswordDto,
    request: Request,
  ) {
    return this.updatePassword(user, dto, request, 'temporary');
  }

  private async updatePassword(
    user: AuthenticatedUser,
    dto: ChangePasswordDto,
    request: Request,
    mode: PasswordChangeMode,
  ) {
    const currentUser = await this.findUserWithAccessById(user.id);

    if (!currentUser) {
      throw new UnauthorizedException('Usuario nao encontrado.');
    }

    if (mode === 'temporary' && !currentUser.mustChangePassword) {
      throw new ConflictException('Este usuario nao exige troca obrigatoria de senha.');
    }

    const isPasswordValid = await argon2.verify(currentUser.passwordHash, dto.currentPassword);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Senha atual invalida.');
    }

    const isSamePassword = await argon2.verify(currentUser.passwordHash, dto.newPassword);
    if (isSamePassword) {
      throw new ConflictException('A nova senha deve ser diferente da atual.');
    }

    const passwordHash = await argon2.hash(dto.newPassword, {
      type: argon2.argon2id,
    });
    let revokedSessionIds: string[] = [];
    const requestId = getRequestId(request);

    await this.prisma.$transaction(async (tx) => {
      const activeUser = await tx.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          status: true,
        },
      });

      if (!activeUser) {
        throw new UnauthorizedException('Usuario nao encontrado.');
      }

      if (activeUser.status !== 'ACTIVE') {
        throw new ForbiddenException('Usuario sem acesso ativo.');
      }

      const sessionsToRevoke = await tx.session.findMany({
        where: {
          userId: user.id,
          id: {
            not: user.sessionId,
          },
          status: 'ACTIVE',
        },
        select: {
          id: true,
        },
      });
      revokedSessionIds = sessionsToRevoke.map((session) => session.id);

      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          mustChangePassword: false,
        },
      });

      await tx.session.updateMany({
        where: {
          userId: user.id,
          id: {
            not: user.sessionId,
          },
          status: 'ACTIVE',
        },
        data: {
          status: 'REVOKED',
          revokedAt: new Date(),
        },
      });

      await this.auditService.record(
        {
          actorId: user.id,
          actorType: 'user',
          action:
            mode === 'temporary'
              ? 'auth.password.temporary.changed'
              : 'auth.password.changed',
          resourceType: 'user',
          resourceId: user.id,
          ipAddress: getRequestIp(request),
          requestId,
          metadata: {
            revokedSessions: revokedSessionIds.length,
            mode,
          },
        },
        tx,
      );
    });

    try {
      await this.evictSessionCaches([...revokedSessionIds, user.sessionId]);
    } catch (error) {
      this.logger.warn(
        `Failed to evict sessions from Redis after password change: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
    }

    return {
      message:
        mode === 'temporary'
          ? 'Senha temporaria atualizada com sucesso.'
          : 'Senha atualizada e outras sessoes revogadas.',
    };
  }

  private async createSessionTokens(user: UserWithAccess, request: Request): Promise<AuthResult> {
    const refreshToken = this.generateRefreshToken();
    const refreshTokenHash = sha256(refreshToken);
    const roles = this.extractRoles(user);
    const permissions = this.extractPermissions(user);
    const areas = this.extractAreas(user);
    const navigation = this.buildNavigationResponse(user, permissions, areas);
    const userResponse = this.buildUserResponse(user, areas, navigation);
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash,
        expiresAt: this.buildRefreshExpiry(),
        ipAddress: getRequestIp(request),
        userAgent: request.headers['user-agent'],
      },
    });

    await this.cacheSessionAuthContext(session.id, session.expiresAt, user, navigation, areas);

    return {
      sessionId: session.id,
      accessToken: this.signAccessToken(user, session.id, roles, permissions, areas),
      refreshToken,
      user: userResponse,
    };
  }

  private async rotateSession(
    sessionId: string,
    user: UserWithAccess,
    request: Request,
  ): Promise<AuthResult> {
    const refreshToken = this.generateRefreshToken();
    const refreshTokenHash = sha256(refreshToken);
    const roles = this.extractRoles(user);
    const permissions = this.extractPermissions(user);
    const areas = this.extractAreas(user);
    const navigation = this.buildNavigationResponse(user, permissions, areas);
    const userResponse = this.buildUserResponse(user, areas, navigation);

    const updatedSession = await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        refreshTokenHash,
        lastUsedAt: new Date(),
        expiresAt: this.buildRefreshExpiry(),
        ipAddress: getRequestIp(request),
        userAgent: request.headers['user-agent'],
      },
    });

    await this.cacheSessionAuthContext(
      sessionId,
      updatedSession.expiresAt,
      user,
      navigation,
      areas,
    );

    return {
      sessionId,
      accessToken: this.signAccessToken(user, sessionId, roles, permissions, areas),
      refreshToken,
      user: userResponse,
    };
  }

  private async ensureUnknownIdentifierIsNotLocked(identifier: string) {
    const activeLock = await this.prisma.loginAttempt.findFirst({
      where: {
        identifier,
        lockedUntil: {
          gt: new Date(),
        },
      },
      orderBy: {
        attemptedAt: 'desc',
      },
    });

    if (activeLock) {
      throw new UnauthorizedException('Usuario temporariamente bloqueado.');
    }
  }

  private ensureUserCanAuthenticate(user: UserWithAccess) {
    if (user.status === 'LOCKED') {
      if (user.lockReason === 'ADMIN') {
        throw new ForbiddenException('Usuario bloqueado pelo backoffice.');
      }

      throw new UnauthorizedException('Usuario temporariamente bloqueado.');
    }

    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException('Usuario sem acesso ativo.');
    }
  }

  private async releaseExpiredFailedAttemptLock(user: UserWithAccess) {
    if (
      user.status === 'LOCKED' &&
      user.lockReason === 'FAILED_ATTEMPTS' &&
      user.lockedUntil &&
      user.lockedUntil <= new Date()
    ) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          status: 'ACTIVE',
          lockedAt: null,
          lockedUntil: null,
          lockReason: null,
          lockedByUserId: null,
        },
      });

      const refreshed = await this.findUserWithAccessById(user.id);
      if (!refreshed) {
        throw new UnauthorizedException('Usuario nao encontrado.');
      }

      return refreshed;
    }

    return user;
  }

  private async registerFailedAttempt(
    identifier: string,
    request: Request,
    user?: UserWithAccess | User,
  ) {
    const now = new Date();
    const windowStart = new Date(now.getTime() - env.LOGIN_LOCK_MINUTES * 60 * 1000);
    const failedAttempts = await this.prisma.loginAttempt.count({
      where: {
        identifier,
        succeeded: false,
        attemptedAt: {
          gte: windowStart,
        },
      },
    });

    const lockReached = failedAttempts + 1 >= env.LOGIN_MAX_ATTEMPTS;
    const lockedUntil = lockReached
      ? new Date(now.getTime() + env.LOGIN_LOCK_MINUTES * 60 * 1000)
      : null;
    let sessionIdsToEvict: string[] = [];

    await this.prisma.$transaction(async (tx) => {
      await tx.loginAttempt.create({
        data: {
          identifier,
          ipAddress: getRequestIp(request),
          succeeded: false,
          userId: user?.id,
          lockedUntil,
          metadata: {
            userAgent: request.headers['user-agent'],
          },
        },
      });

      if (lockReached && user) {
        const activeSessions = await tx.session.findMany({
          where: {
            userId: user.id,
            status: 'ACTIVE',
          },
          select: {
            id: true,
          },
        });
        sessionIdsToEvict = activeSessions.map((session) => session.id);

        await tx.user.update({
          where: { id: user.id },
          data: {
            status: 'LOCKED',
            lockedAt: now,
            lockedUntil,
            lockReason: 'FAILED_ATTEMPTS',
            lockedByUserId: null,
          },
        });

        if (sessionIdsToEvict.length) {
          await tx.session.updateMany({
            where: {
              userId: user.id,
              status: 'ACTIVE',
            },
            data: {
              status: 'REVOKED',
              revokedAt: now,
            },
          });
        }
      }
    });

    if (sessionIdsToEvict.length) {
      await this.evictSessionCaches(sessionIdsToEvict);
    }

    await this.auditService.record({
      actorId: user?.id ?? null,
      actorType: 'user',
      action: 'auth.login.failed',
      resourceType: 'user',
      resourceId: user?.id ?? null,
      ipAddress: getRequestIp(request),
      requestId: getRequestId(request),
      metadata: {
        identifier,
        lockReached,
        lockedUntil: lockedUntil?.toISOString() ?? null,
      },
    });
  }

  private buildUserResponse(
    user: UserWithAccess,
    areas: AppArea[] = this.extractAreas(user),
    navigation: NavigationResponse = this.buildNavigationResponse(
      user,
      this.extractPermissions(user),
      areas,
    ),
  ): AuthUserResponse {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      roles: this.extractRoles(user),
      permissions: this.extractPermissions(user),
      areas,
      status: user.status,
      mfaEnabled: user.mfaEnabled,
      mustChangePassword: user.mustChangePassword,
      defaultPath: navigation.defaultPath,
      lockReason: user.lockReason,
      lockedUntil: user.lockedUntil?.toISOString() ?? null,
    };
  }

  private toAuthUserResponse(user: AuthenticatedUser): AuthUserResponse {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      roles: user.roles,
      permissions: user.permissions,
      areas: user.areas,
      status: user.status,
      mfaEnabled: user.mfaEnabled,
      mustChangePassword: user.mustChangePassword,
      defaultPath: user.defaultPath,
      lockReason: user.lockReason,
      lockedUntil: user.lockedUntil,
    };
  }

  private buildSessionResponse(session: Session, currentSessionId: string): SessionItem {
    return {
      id: session.id,
      userAgent: session.userAgent ?? null,
      ipAddress: session.ipAddress ?? null,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
      lastUsedAt: session.lastUsedAt?.toISOString() ?? null,
      revokedAt: session.revokedAt?.toISOString() ?? null,
      status: this.resolveSessionStatus(session),
      current: session.id === currentSessionId,
    };
  }

  private buildRefreshExpiry() {
    return new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  }

  private extractRoles(user: UserWithAccess): AppRole[] {
    return user.roles
      .filter((userRole) => userRole.role.isActive)
      .map((userRole) => userRole.role.name);
  }

  private extractPermissions(user: UserWithAccess): AppPermission[] {
    return [
      ...new Set(
        user.roles
          .filter((userRole) => userRole.role.isActive)
          .flatMap((userRole) =>
            userRole.role.permissions
              .filter((rolePermission) => rolePermission.permission.isActive)
              .map((rolePermission) => rolePermission.permission.name),
          ),
      ),
    ];
  }

  private extractAreas(user: UserWithAccess): AppArea[] {
    const areas = new Set<AppArea>();

    for (const userRole of user.roles) {
      if (!userRole.role.isActive) {
        continue;
      }

      this.pushAreasFromScope(areas, userRole.role.scope);

      for (const rolePermission of userRole.role.permissions) {
        if (!rolePermission.permission.isActive) {
          continue;
        }

        this.pushAreasFromScope(areas, rolePermission.permission.scope);

        for (const permissionScreen of rolePermission.permission.screens) {
          if (permissionScreen.screen.isActive) {
            areas.add(permissionScreen.screen.area as AppArea);
          }
        }
      }
    }

    return [...areas];
  }

  private pushAreasFromScope(areas: Set<AppArea>, scope: string) {
    if (scope === 'BACKOFFICE' || scope === 'BOTH') {
      areas.add('BACKOFFICE');
    }

    if (scope === 'APP' || scope === 'BOTH') {
      areas.add('APP');
    }
  }

  private resolveDefaultPath(areas: AppArea[], mustChangePassword: boolean) {
    if (mustChangePassword) {
      return '/change-password';
    }

    if (areas.includes('BACKOFFICE')) {
      return '/backoffice';
    }

    if (areas.includes('APP')) {
      return '/app';
    }

    return '/forbidden';
  }

  private buildNavigationResponse(
    user: UserWithAccess,
    permissions: AppPermission[] = this.extractPermissions(user),
    areas: AppArea[] = this.extractAreas(user),
  ): NavigationResponse {
    const permissionSet = new Set(permissions);
    const itemMap = new Map<string, NavigationItem>();

    for (const userRole of user.roles) {
      if (!userRole.role.isActive) {
        continue;
      }

      for (const rolePermission of userRole.role.permissions) {
        if (!rolePermission.permission.isActive || !permissionSet.has(rolePermission.permission.name)) {
          continue;
        }

        for (const permissionScreen of rolePermission.permission.screens) {
          const screen = permissionScreen.screen;
          if (!screen.isActive) {
            continue;
          }

          const existing = itemMap.get(screen.key);
          if (existing) {
            if (!existing.permissions.includes(rolePermission.permission.name)) {
              existing.permissions.push(rolePermission.permission.name);
            }
            continue;
          }

          itemMap.set(screen.key, {
            key: screen.key,
            title: screen.title,
            path: screen.path,
            group: screen.group,
            area: screen.area as AppArea,
            permissions: [rolePermission.permission.name],
          });
        }
      }
    }

    const items = [...itemMap.values()].sort((left, right) => {
      return (
        left.area.localeCompare(right.area) ||
        left.group.localeCompare(right.group) ||
        left.title.localeCompare(right.title)
      );
    });

    return {
      items,
      areas,
      defaultPath: this.resolveDefaultPath(areas, user.mustChangePassword),
    };
  }

  private signAccessToken(
    user: UserWithAccess,
    sessionId: string,
    roles: AppRole[],
    permissions: AppPermission[],
    areas: AppArea[],
  ) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      sessionId,
      roles,
      permissions,
      areas,
      mustChangePassword: user.mustChangePassword,
    };

    return this.jwtService.sign(payload, {
      secret: env.JWT_ACCESS_SECRET,
      expiresIn: `${env.ACCESS_TOKEN_TTL_MINUTES}m`,
    });
  }

  private resolveSessionStatus(session: Session): SessionStatus {
    if (session.status === 'ACTIVE' && session.expiresAt <= new Date()) {
      return 'EXPIRED';
    }

    return session.status;
  }

  private generateRefreshToken() {
    return randomBytes(48).toString('hex');
  }

  private async cacheSessionAuthContext(
    sessionId: string,
    expiresAt: Date,
    user: UserWithAccess,
    navigation: NavigationResponse,
    areas: AppArea[],
  ) {
    const ttlSeconds = Math.max(1, Math.ceil((expiresAt.getTime() - Date.now()) / 1_000));
    const payload: CachedSessionAuthContext = {
      sessionId,
      userId: user.id,
      name: user.name,
      email: user.email,
      status: user.status,
      mfaEnabled: user.mfaEnabled,
      roles: this.extractRoles(user),
      permissions: this.extractPermissions(user),
      areas,
      mustChangePassword: user.mustChangePassword,
      defaultPath: navigation.defaultPath,
      lockReason: user.lockReason,
      lockedUntil: user.lockedUntil?.toISOString() ?? null,
      navigation,
      expiresAt: expiresAt.toISOString(),
    };

    await this.redis
      .getClient()
      .set(buildSessionCacheKey(sessionId), JSON.stringify(payload), 'EX', ttlSeconds);
  }

  private async evictSessionCaches(sessionIds: string[]) {
    const keys = [...new Set(sessionIds.map((sessionId) => buildSessionCacheKey(sessionId)))];
    if (!keys.length) {
      return;
    }

    await this.redis.getClient().del(...keys);
  }

  private userAccessInclude() {
    return {
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
    } satisfies Prisma.UserInclude;
  }

  private findUserWithAccessByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: this.userAccessInclude(),
    });
  }

  private findUserWithAccessById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: this.userAccessInclude(),
    });
  }
}
