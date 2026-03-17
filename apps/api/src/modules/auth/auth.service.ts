import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, type User } from '@prisma/client';
import argon2 from 'argon2';
import { randomBytes } from 'crypto';
import type { Request } from 'express';
import type { AppRole } from '@financial-martec/contracts';
import { authCookieOptions, env } from '@/common/config/env';
import { sha256 } from '@/common/lib/hash.util';
import { getRequestIp } from '@/common/lib/request.util';
import { PrismaService } from '@/common/prisma/prisma.service';
import { RedisService } from '@/common/redis/redis.service';
import { AuditService } from '@/modules/audit/audit.service';
import type { AuthenticatedUser, JwtPayload } from './auth.types';
import { LoginDto } from './dto/login.dto';

const ACCESS_COOKIE_NAME = 'fm_access_token';
const REFRESH_COOKIE_NAME = 'fm_refresh_token';

type UserWithRoles = Prisma.UserGetPayload<{
  include: {
    roles: {
      include: {
        role: true;
      };
    };
  };
}>;

@Injectable()
export class AuthService {
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

    const user = await this.prisma.user.findUnique({
      where: { email: identifier },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    const isPasswordValid =
      user && (await argon2.verify(user.passwordHash, dto.password));

    if (!user || !isPasswordValid) {
      await this.registerFailedAttempt(identifier, request, user ?? undefined);
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException('Usuário sem acesso ativo.');
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
                role: true,
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
      throw new UnauthorizedException('Sessão inválida ou expirada.');
    }

    const rotated = await this.rotateSession(session.id, session.user, request);

    await this.auditService.record({
      actorId: session.userId,
      actorType: 'user',
      action: 'auth.refresh',
      resourceType: 'session',
      resourceId: session.id,
      ipAddress: getRequestIp(request),
      metadata: {
        email: session.user.email,
      },
    });

    return rotated;
  }

  async logout(user: AuthenticatedUser) {
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

    await this.redis.getClient().del(this.getSessionCacheKey(user.sessionId));

    await this.auditService.record({
      actorId: user.id,
      actorType: 'user',
      action: 'auth.logout',
      resourceType: 'session',
      resourceId: user.sessionId,
    });
  }

  async getMe(user: AuthenticatedUser) {
    const currentUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!currentUser) {
      throw new UnauthorizedException('Usuário não encontrado.');
    }

    return this.buildUserResponse(currentUser);
  }

  private async createSessionTokens(user: UserWithRoles, request: Request) {
    const refreshToken = this.generateRefreshToken();
    const refreshTokenHash = sha256(refreshToken);
    const roles = this.extractRoles(user);
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash,
        expiresAt: this.buildRefreshExpiry(),
        ipAddress: getRequestIp(request),
        userAgent: request.headers['user-agent'],
      },
    });

    await this.redis
      .getClient()
      .set(
        this.getSessionCacheKey(session.id),
        JSON.stringify({ userId: user.id }),
        'EX',
        env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60,
      );

    return {
      sessionId: session.id,
      accessToken: this.signAccessToken(user, session.id, roles),
      refreshToken,
      user: this.buildUserResponse(user),
    };
  }

  private async rotateSession(sessionId: string, user: UserWithRoles, request: Request) {
    const refreshToken = this.generateRefreshToken();
    const refreshTokenHash = sha256(refreshToken);
    const roles = this.extractRoles(user);

    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        refreshTokenHash,
        lastUsedAt: new Date(),
        expiresAt: this.buildRefreshExpiry(),
        ipAddress: getRequestIp(request),
        userAgent: request.headers['user-agent'],
      },
    });

    await this.redis
      .getClient()
      .set(
        this.getSessionCacheKey(sessionId),
        JSON.stringify({ userId: user.id }),
        'EX',
        env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60,
      );

    return {
      sessionId,
      accessToken: this.signAccessToken(user, sessionId, roles),
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
      throw new UnauthorizedException('Usuário temporariamente bloqueado.');
    }
  }

  private async registerFailedAttempt(identifier: string, request: Request, user?: User) {
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
      metadata: {
        identifier,
      },
    });
  }

  private buildUserResponse(user: UserWithRoles) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      roles: this.extractRoles(user),
      status: user.status,
      mfaEnabled: user.mfaEnabled,
    };
  }

  private buildRefreshExpiry() {
    return new Date(
      Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
    );
  }

  private extractRoles(user: UserWithRoles): AppRole[] {
    return user.roles.map((userRole: UserWithRoles['roles'][number]) => userRole.role.name as AppRole);
  }

  private signAccessToken(user: UserWithRoles, sessionId: string, roles: AppRole[]) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      sessionId,
      roles,
    };

    return this.jwtService.sign(payload, {
      secret: env.JWT_ACCESS_SECRET,
      expiresIn: `${env.ACCESS_TOKEN_TTL_MINUTES}m`,
    });
  }

  private generateRefreshToken() {
    return randomBytes(48).toString('hex');
  }

  private getSessionCacheKey(sessionId: string) {
    return `session:${sessionId}`;
  }
}
