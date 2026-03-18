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
  AppPermission,
  AppRole,
  AuthUserResponse,
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
                permission: true;
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
    const identifier = dto.email.toLowerCase();
    await this.ensureIdentifierIsNotLocked(identifier);

    const user = await this.findUserWithAccessByEmail(identifier);
    const isPasswordValid = user && (await argon2.verify(user.passwordHash, dto.password));

    if (!user || !isPasswordValid) {
      await this.registerFailedAttempt(identifier, request, user ?? undefined);
      throw new UnauthorizedException('Credenciais invalidas.');
    }

    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException('Usuario sem acesso ativo.');
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

    if (
      !session ||
      session.status !== 'ACTIVE' ||
      session.expiresAt <= new Date() ||
      session.user.status !== 'ACTIVE'
    ) {
      throw new UnauthorizedException('Sessao invalida ou expirada.');
    }

    const rotated = await this.rotateSession(session.id, session.user, request);

    await this.auditService.record({
      actorId: session.userId,
      actorType: 'user',
      action: 'auth.refresh',
      resourceType: 'session',
      resourceId: session.id,
      ipAddress: getRequestIp(request),
      requestId: getRequestId(request),
      metadata: {
        email: session.user.email,
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

  async getMe(user: AuthenticatedUser) {
    const currentUser = await this.findUserWithAccessById(user.id);

    if (!currentUser) {
      throw new UnauthorizedException('Usuario nao encontrado.');
    }

    return this.buildUserResponse(currentUser);
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

  async changePassword(
    user: AuthenticatedUser,
    dto: ChangePasswordDto,
    request: Request,
  ) {
    const currentUser = await this.findUserWithAccessById(user.id);

    if (!currentUser) {
      throw new UnauthorizedException('Usuario nao encontrado.');
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
          action: 'auth.password.changed',
          resourceType: 'user',
          resourceId: user.id,
          ipAddress: getRequestIp(request),
          requestId,
          metadata: {
            revokedSessions: revokedSessionIds.length,
          },
        },
        tx,
      );
    });

    if (revokedSessionIds.length) {
      try {
        await this.evictSessionCaches(revokedSessionIds);
      } catch (error) {
        this.logger.warn(
          `Failed to evict revoked sessions from Redis after password change: ${
            error instanceof Error ? error.message : 'unknown'
          }`,
        );
      }
    }

    return {
      message: 'Senha atualizada e outras sessoes revogadas.',
    };
  }

  private async createSessionTokens(user: UserWithAccess, request: Request): Promise<AuthResult> {
    const refreshToken = this.generateRefreshToken();
    const refreshTokenHash = sha256(refreshToken);
    const roles = this.extractRoles(user);
    const permissions = this.extractPermissions(user);
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash,
        expiresAt: this.buildRefreshExpiry(),
        ipAddress: getRequestIp(request),
        userAgent: request.headers['user-agent'],
      },
    });

    await this.cacheSessionAuthContext(session.id, session.expiresAt, user);

    return {
      sessionId: session.id,
      accessToken: this.signAccessToken(user, session.id, roles, permissions),
      refreshToken,
      user: this.buildUserResponse(user),
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

    await this.cacheSessionAuthContext(sessionId, updatedSession.expiresAt, user);

    return {
      sessionId,
      accessToken: this.signAccessToken(user, sessionId, roles, permissions),
      refreshToken,
      user: this.buildUserResponse(user),
    };
  }

  private async ensureIdentifierIsNotLocked(identifier: string) {
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

  private async registerFailedAttempt(identifier: string, request: Request, user?: UserWithAccess | User) {
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

    await this.prisma.loginAttempt.create({
      data: {
        identifier,
        ipAddress: getRequestIp(request),
        succeeded: false,
        userId: user?.id,
        lockedUntil: lockReached
          ? new Date(now.getTime() + env.LOGIN_LOCK_MINUTES * 60 * 1000)
          : null,
        metadata: {
          userAgent: request.headers['user-agent'],
        },
      },
    });

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
      },
    });
  }

  private buildUserResponse(user: UserWithAccess): AuthUserResponse {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      roles: this.extractRoles(user),
      permissions: this.extractPermissions(user),
      status: user.status,
      mfaEnabled: user.mfaEnabled,
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
    return user.roles.map((userRole) => userRole.role.name as AppRole);
  }

  private extractPermissions(user: UserWithAccess): AppPermission[] {
    return [...new Set(
      user.roles.flatMap((userRole) =>
        userRole.role.permissions.map(
          (rolePermission) => rolePermission.permission.name as AppPermission,
        ),
      ),
    )];
  }

  private signAccessToken(
    user: UserWithAccess,
    sessionId: string,
    roles: AppRole[],
    permissions: AppPermission[],
  ) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      sessionId,
      roles,
      permissions,
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
  ) {
    const ttlSeconds = Math.max(
      1,
      Math.ceil((expiresAt.getTime() - Date.now()) / 1_000),
    );
    const payload: CachedSessionAuthContext = {
      sessionId,
      userId: user.id,
      email: user.email,
      status: user.status,
      roles: this.extractRoles(user),
      permissions: this.extractPermissions(user),
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

  private findUserWithAccessByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
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
    });
  }

  private findUserWithAccessById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
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
    });
  }
}
