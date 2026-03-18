import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import argon2 from 'argon2';
import type {
  AppPermission,
  AppRole,
  CreateIamUserRequest,
  IamPermissionItem,
  IamRoleItem,
  IamUserDetail,
  IamUserListItem,
  UpdateIamUserStatusRequest,
} from '@financial-martec/contracts';
import { buildPaginatedResponse } from '@/common/lib/pagination.util';
import { PrismaService } from '@/common/prisma/prisma.service';
import { RedisService } from '@/common/redis/redis.service';
import { AuditService } from '@/modules/audit/audit.service';
import { buildSessionCacheKey } from '@/modules/auth/auth-session-cache';
import type { QueryIamUsersDto } from './dto/query-iam-users.dto';
import type { ReplaceIamUserRolesDto } from './dto/replace-iam-user-roles.dto';

@Injectable()
export class IamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly auditService: AuditService,
  ) {}

  async getUserRoles(userId: string) {
    const roles = await this.prisma.userRole.findMany({
      where: { userId },
      include: {
        role: true,
      },
    });

    return roles.map((userRole) => userRole.role.name);
  }

  async listPermissions(): Promise<IamPermissionItem[]> {
    const permissions = await this.prisma.permission.findMany({
      orderBy: {
        name: 'asc',
      },
    });

    return permissions.map((permission) => ({
      name: permission.name as AppPermission,
      description: permission.description ?? null,
    }));
  }

  async listRoles(): Promise<IamRoleItem[]> {
    const roles = await this.prisma.role.findMany({
      orderBy: {
        name: 'asc',
      },
      include: {
        permissions: {
          include: {
            permission: true,
          },
          orderBy: {
            permission: {
              name: 'asc',
            },
          },
        },
      },
    });

    return roles.map((role) => ({
      name: role.name as AppRole,
      description: role.description ?? null,
      permissions: role.permissions.map(
        (rolePermission) => rolePermission.permission.name as AppPermission,
      ),
    }));
  }

  async listUsers(query: QueryIamUsersDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = {
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' as const } },
              { email: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.role
        ? {
            roles: {
              some: {
                role: {
                  name: query.role,
                },
              },
            },
          }
        : {}),
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
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
      }),
      this.prisma.user.count({ where }),
    ]);

    return buildPaginatedResponse(
      users.map((user) => this.toIamUserListItem(user)),
      page,
      pageSize,
      total,
    );
  }

  async getUser(userId: string): Promise<IamUserDetail> {
    const user = await this.findUserWithAccessOrThrow(userId);
    return this.toIamUserDetail(user);
  }

  async createUser(
    dto: CreateIamUserRequest,
    actorUserId: string,
    requestId?: string | null,
    ipAddress?: string | null,
  ) {
    const email = dto.email.trim().toLowerCase();
    const roleIds = await this.resolveRoleIds(dto.roles);
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      throw new ConflictException('Ja existe um usuario com este e-mail.');
    }

    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });

    const createdUserId = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: dto.name.trim(),
          email,
          passwordHash,
          status: dto.status ?? 'ACTIVE',
        },
      });

      await tx.userRole.createMany({
        data: roleIds.map((roleId) => ({
          userId: user.id,
          roleId,
        })),
      });

      await this.auditService.record(
        {
          actorId: actorUserId,
          actorType: 'user',
          action: 'iam.user.created',
          resourceType: 'user',
          resourceId: user.id,
          ipAddress,
          requestId,
          metadata: {
            email,
            roles: [...new Set(dto.roles)],
            status: dto.status ?? 'ACTIVE',
          },
        },
        tx,
      );

      return user.id;
    });

    return this.getUser(createdUserId);
  }

  async updateUserStatus(
    userId: string,
    dto: UpdateIamUserStatusRequest,
    actorUserId: string,
    requestId?: string | null,
    ipAddress?: string | null,
  ) {
    let sessionIdsToEvict: string[] = [];
    await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        include: {
          roles: {
            include: {
              role: true,
            },
          },
        },
      });

      if (!user) {
        throw new NotFoundException('Usuario nao encontrado.');
      }

      const currentRoles = user.roles.map((userRole) => userRole.role.name as AppRole);
      if (dto.status === 'INACTIVE' && currentRoles.includes('owner')) {
        await this.ensureAnotherActiveOwnerExists(tx, user.id);
      }

      if (dto.status === 'INACTIVE') {
        const sessionsToRevoke = await tx.session.findMany({
          where: {
            userId: user.id,
            status: 'ACTIVE',
          },
          select: {
            id: true,
          },
        });
        sessionIdsToEvict = sessionsToRevoke.map((session) => session.id);

        await tx.session.updateMany({
          where: {
            userId: user.id,
            status: 'ACTIVE',
          },
          data: {
            status: 'REVOKED',
            revokedAt: new Date(),
          },
        });
      }

      await tx.user.update({
        where: { id: user.id },
        data: {
          status: dto.status,
        },
      });

      await this.auditService.record(
        {
          actorId: actorUserId,
          actorType: 'user',
          action: 'iam.user.status.updated',
          resourceType: 'user',
          resourceId: user.id,
          ipAddress,
          requestId,
          metadata: {
            previousStatus: user.status,
            nextStatus: dto.status,
          },
        },
        tx,
      );
    });

    await this.evictSessionCaches(sessionIdsToEvict);

    return this.getUser(userId);
  }

  async replaceUserRoles(
    userId: string,
    dto: ReplaceIamUserRolesDto,
    actorUserId: string,
    requestId?: string | null,
    ipAddress?: string | null,
  ) {
    const uniqueRoles = [...new Set(dto.roles)];
    const roleIds = await this.resolveRoleIds(uniqueRoles);

    await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        include: {
          roles: {
            include: {
              role: true,
            },
          },
        },
      });

      if (!user) {
        throw new NotFoundException('Usuario nao encontrado.');
      }

      const currentRoles = user.roles.map((userRole) => userRole.role.name as AppRole);
      if (currentRoles.includes('owner') && !uniqueRoles.includes('owner')) {
        await this.ensureAnotherActiveOwnerExists(tx, user.id);
      }

      await tx.userRole.deleteMany({
        where: {
          userId: user.id,
        },
      });

      await tx.userRole.createMany({
        data: roleIds.map((roleId) => ({
          userId: user.id,
          roleId,
        })),
      });

      await this.auditService.record(
        {
          actorId: actorUserId,
          actorType: 'user',
          action: 'iam.user.roles.replaced',
          resourceType: 'user',
          resourceId: user.id,
          ipAddress,
          requestId,
          metadata: {
            previousRoles: currentRoles,
            nextRoles: uniqueRoles,
          },
        },
        tx,
      );
    });

    await this.invalidateUserSessionCaches(userId);

    return this.getUser(userId);
  }

  private async findUserWithAccessOrThrow(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
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

    if (!user) {
      throw new NotFoundException('Usuario nao encontrado.');
    }

    return user;
  }

  private async resolveRoleIds(roleNames: AppRole[]) {
    const uniqueRoles = [...new Set(roleNames)];
    const roles = await this.prisma.role.findMany({
      where: {
        name: {
          in: uniqueRoles,
        },
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (roles.length !== uniqueRoles.length) {
      throw new NotFoundException('Um ou mais perfis informados nao existem.');
    }

    return uniqueRoles.map((roleName) => {
      const role = roles.find((candidate) => candidate.name === roleName);
      if (!role) {
        throw new NotFoundException('Um ou mais perfis informados nao existem.');
      }

      return role.id;
    });
  }

  private async ensureAnotherActiveOwnerExists(
    tx: Prisma.TransactionClient,
    excludedUserId: string,
  ) {
    const activeOwnerCount = await tx.user.count({
      where: {
        id: {
          not: excludedUserId,
        },
        status: 'ACTIVE',
        roles: {
          some: {
            role: {
              name: 'owner',
            },
          },
        },
      },
    });

    if (activeOwnerCount === 0) {
      throw new ForbiddenException('Nao e permitido remover ou inativar o ultimo owner ativo.');
    }
  }

  private toIamUserListItem(
    user: Prisma.UserGetPayload<{
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
    }>,
  ): IamUserListItem {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      status: user.status,
      roles: user.roles.map((userRole) => userRole.role.name as AppRole),
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    };
  }

  private toIamUserDetail(
    user: Prisma.UserGetPayload<{
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
    }>,
  ): IamUserDetail {
    return {
      ...this.toIamUserListItem(user),
      permissions: [
        ...new Set(
          user.roles.flatMap((userRole) =>
            userRole.role.permissions.map(
              (rolePermission) => rolePermission.permission.name as AppPermission,
            ),
          ),
        ),
      ],
    };
  }

  private async invalidateUserSessionCaches(userId: string) {
    const sessions = await this.prisma.session.findMany({
      where: {
        userId,
        status: 'ACTIVE',
      },
      select: {
        id: true,
      },
    });

    await this.evictSessionCaches(sessions.map((session) => session.id));
  }

  private async evictSessionCaches(sessionIds: string[]) {
    const keys = [...new Set(sessionIds.map((sessionId) => buildSessionCacheKey(sessionId)))];
    if (!keys.length) {
      return;
    }

    await this.redis.getClient().del(...keys);
  }
}
