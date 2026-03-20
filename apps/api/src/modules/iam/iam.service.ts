import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import argon2 from 'argon2';
import type {
  AdminResetPasswordRequest,
  AppArea,
  AppScreenItem,
  CreateIamUserRequest,
  CreatePermissionRequest,
  CreateRoleRequest,
  IamPermissionItem,
  IamRoleItem,
  IamUserDetail,
  IamUserListItem,
  PermissionDetail,
  ReplaceIamUserRolesRequest,
  ReplacePermissionScreensRequest,
  ReplaceRolePermissionsRequest,
  RoleDetail,
  UnlockUserRequest,
  UpdateIamUserStatusRequest,
  UpdatePermissionRequest,
  UpdateRoleRequest,
  UpdateUserProfileRequest,
} from '@financial-martec/contracts';
import { buildPaginatedResponse } from '@/common/lib/pagination.util';
import { PrismaService } from '@/common/prisma/prisma.service';
import { RedisService } from '@/common/redis/redis.service';
import { AuditService } from '@/modules/audit/audit.service';
import { buildSessionCacheKey } from '@/modules/auth/auth-session-cache';
import { IamCatalogSyncService } from './iam-catalog-sync.service';
import type { QueryIamUsersDto } from './dto/query-iam-users.dto';

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

type UserListRow = Prisma.UserGetPayload<{
  include: {
    roles: {
      include: {
        role: true;
      };
    };
  };
}>;

type RoleListRow = Prisma.RoleGetPayload<{
  include: {
    permissions: {
      include: {
        permission: {
          select: {
            name: true;
          };
        };
      };
    };
  };
}>;

type RoleWithPermissions = Prisma.RoleGetPayload<{
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
}>;

type PermissionListRow = Prisma.PermissionGetPayload<{
  include: {
    screens: {
      include: {
        screen: {
          select: {
            key: true;
          };
        };
      };
    };
  };
}>;

type PermissionWithScreens = Prisma.PermissionGetPayload<{
  include: {
    screens: {
      include: {
        screen: true;
      };
    };
  };
}>;

@Injectable()
export class IamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly auditService: AuditService,
    private readonly catalogSyncService: IamCatalogSyncService,
  ) {}

  async listPermissions(): Promise<IamPermissionItem[]> {
    await this.catalogSyncService.sync();

    const permissions = await this.prisma.permission.findMany({
      orderBy: [{ scope: 'asc' }, { name: 'asc' }],
      include: {
        screens: {
          include: {
            screen: {
              select: {
                key: true,
              },
            },
          },
          orderBy: {
            screen: {
              path: 'asc',
            },
          },
        },
      },
    });

    return permissions.map((permission) => this.toPermissionItem(permission));
  }

  async getPermission(permissionId: string): Promise<PermissionDetail> {
    const permission = await this.prisma.permission.findUnique({
      where: { id: permissionId },
      include: {
        screens: {
          include: {
            screen: true,
          },
          orderBy: {
            screen: {
              path: 'asc',
            },
          },
        },
      },
    });

    if (!permission) {
      throw new NotFoundException('Permissao nao encontrada.');
    }

    return this.toPermissionDetail(permission);
  }

  async createPermission(
    dto: CreatePermissionRequest,
    actorUserId: string,
    requestId?: string | null,
    ipAddress?: string | null,
  ) {
    const name = dto.name.trim();
    const existing = await this.prisma.permission.findUnique({
      where: { name },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('Ja existe uma permissao com este nome.');
    }

    const permission = await this.prisma.permission.create({
      data: {
        name,
        description: dto.description?.trim() || null,
        scope: dto.scope,
        isSystem: false,
        isActive: true,
      },
      include: {
        screens: {
          include: {
            screen: true,
          },
        },
      },
    });

    await this.auditService.record({
      actorId: actorUserId,
      actorType: 'user',
      action: 'iam.permission.created',
      resourceType: 'permission',
      resourceId: permission.id,
      ipAddress,
      requestId,
      metadata: {
        name: permission.name,
        scope: permission.scope,
      },
    });

    return this.toPermissionDetail(permission);
  }

  async updatePermission(
    permissionId: string,
    dto: UpdatePermissionRequest,
    actorUserId: string,
    requestId?: string | null,
    ipAddress?: string | null,
  ) {
    const permission = await this.prisma.permission.findUnique({
      where: { id: permissionId },
    });

    if (!permission) {
      throw new NotFoundException('Permissao nao encontrada.');
    }

    if (
      permission.isSystem &&
      ((dto.name && dto.name.trim() !== permission.name) ||
        (dto.scope && dto.scope !== permission.scope) ||
        (dto.isActive !== undefined && dto.isActive !== permission.isActive))
    ) {
      throw new ForbiddenException(
        'Permissoes de sistema nao podem ser renomeadas, desativadas ou mudar de escopo.',
      );
    }

    if (dto.name && dto.name.trim() !== permission.name) {
      const existing = await this.prisma.permission.findUnique({
        where: { name: dto.name.trim() },
        select: { id: true },
      });

      if (existing && existing.id !== permissionId) {
        throw new ConflictException('Ja existe uma permissao com este nome.');
      }
    }

    const updated = await this.prisma.permission.update({
      where: { id: permissionId },
      data: {
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
        ...(dto.scope ? { scope: dto.scope } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      include: {
        screens: {
          include: {
            screen: true,
          },
        },
      },
    });

    await this.invalidatePermissionSessionCaches(permissionId);

    await this.auditService.record({
      actorId: actorUserId,
      actorType: 'user',
      action: 'iam.permission.updated',
      resourceType: 'permission',
      resourceId: updated.id,
      ipAddress,
      requestId,
      metadata: {
        name: updated.name,
        scope: updated.scope,
        isActive: updated.isActive,
      },
    });

    return this.toPermissionDetail(updated);
  }

  async replacePermissionScreens(
    permissionId: string,
    dto: ReplacePermissionScreensRequest,
    actorUserId: string,
    requestId?: string | null,
    ipAddress?: string | null,
  ) {
    const permission = await this.prisma.permission.findUnique({
      where: { id: permissionId },
      select: { id: true, name: true },
    });

    if (!permission) {
      throw new NotFoundException('Permissao nao encontrada.');
    }

    const screenIds = await this.resolveScreenIds(dto.screens);

    await this.prisma.$transaction(async (tx) => {
      await tx.permissionScreen.deleteMany({
        where: {
          permissionId,
        },
      });

      if (screenIds.length) {
        await tx.permissionScreen.createMany({
          data: screenIds.map((screenId) => ({
            permissionId,
            screenId,
          })),
        });
      }

      await this.auditService.record(
        {
          actorId: actorUserId,
          actorType: 'user',
          action: 'iam.permission.screens.replaced',
          resourceType: 'permission',
          resourceId: permissionId,
          ipAddress,
          requestId,
          metadata: {
            permission: permission.name,
            screens: dto.screens,
          },
        },
        tx,
      );
    });

    return this.getPermission(permissionId);
  }

  async listRoles(): Promise<IamRoleItem[]> {
    const roles = await this.prisma.role.findMany({
      orderBy: [{ scope: 'asc' }, { name: 'asc' }],
      include: {
        permissions: {
          include: {
            permission: {
              select: {
                name: true,
              },
            },
          },
          orderBy: {
            permission: {
              name: 'asc',
            },
          },
        },
      },
    });

    return roles.map((role) => this.toRoleItem(role));
  }

  async getRole(roleId: string): Promise<RoleDetail> {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
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
          orderBy: {
            permission: {
              name: 'asc',
            },
          },
        },
      },
    });

    if (!role) {
      throw new NotFoundException('Role nao encontrada.');
    }

    return this.toRoleDetail(role);
  }

  async createRole(
    dto: CreateRoleRequest,
    actorUserId: string,
    requestId?: string | null,
    ipAddress?: string | null,
  ) {
    const name = dto.name.trim();
    const existing = await this.prisma.role.findUnique({
      where: { name },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('Ja existe uma role com este nome.');
    }

    const role = await this.prisma.role.create({
      data: {
        name,
        description: dto.description?.trim() || null,
        scope: dto.scope,
        isSystem: false,
        isActive: true,
      },
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
    });

    await this.auditService.record({
      actorId: actorUserId,
      actorType: 'user',
      action: 'iam.role.created',
      resourceType: 'role',
      resourceId: role.id,
      ipAddress,
      requestId,
      metadata: {
        name: role.name,
        scope: role.scope,
      },
    });

    return this.toRoleDetail(role);
  }

  async updateRole(
    roleId: string,
    dto: UpdateRoleRequest,
    actorUserId: string,
    requestId?: string | null,
    ipAddress?: string | null,
  ) {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      throw new NotFoundException('Role nao encontrada.');
    }

    if (
      role.isSystem &&
      ((dto.name && dto.name.trim() !== role.name) ||
        (dto.scope && dto.scope !== role.scope) ||
        (dto.isActive !== undefined && dto.isActive !== role.isActive))
    ) {
      throw new ForbiddenException(
        'Roles de sistema nao podem ser renomeadas, desativadas ou mudar de escopo.',
      );
    }

    if (dto.name && dto.name.trim() !== role.name) {
      const existing = await this.prisma.role.findUnique({
        where: { name: dto.name.trim() },
        select: { id: true },
      });

      if (existing && existing.id !== roleId) {
        throw new ConflictException('Ja existe uma role com este nome.');
      }
    }

    if (dto.isActive === false && role.name === 'owner') {
      throw new ForbiddenException('A role owner de sistema nao pode ser desativada.');
    }

    const updated = await this.prisma.role.update({
      where: { id: roleId },
      data: {
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
        ...(dto.scope ? { scope: dto.scope } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
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
    });

    await this.invalidateRoleUserSessionCaches(roleId);

    await this.auditService.record({
      actorId: actorUserId,
      actorType: 'user',
      action: 'iam.role.updated',
      resourceType: 'role',
      resourceId: updated.id,
      ipAddress,
      requestId,
      metadata: {
        name: updated.name,
        scope: updated.scope,
        isActive: updated.isActive,
      },
    });

    return this.toRoleDetail(updated);
  }

  async replaceRolePermissions(
    roleId: string,
    dto: ReplaceRolePermissionsRequest,
    actorUserId: string,
    requestId?: string | null,
    ipAddress?: string | null,
  ) {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      select: { id: true, name: true, isSystem: true },
    });

    if (!role) {
      throw new NotFoundException('Role nao encontrada.');
    }

    if (role.isSystem) {
      throw new ForbiddenException('Roles de sistema nao podem ter suas permissoes substituidas.');
    }

    const permissionIds = await this.resolvePermissionIds(dto.permissions);

    await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({
        where: {
          roleId,
        },
      });

      if (permissionIds.length) {
        await tx.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({
            roleId,
            permissionId,
          })),
        });
      }

      await this.auditService.record(
        {
          actorId: actorUserId,
          actorType: 'user',
          action: 'iam.role.permissions.replaced',
          resourceType: 'role',
          resourceId: roleId,
          ipAddress,
          requestId,
          metadata: {
            role: role.name,
            permissions: dto.permissions,
          },
        },
        tx,
      );
    });

    await this.invalidateRoleUserSessionCaches(roleId);

    return this.getRole(roleId);
  }

  async listUsers(query: QueryIamUsersDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.UserWhereInput = {
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
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
              role: true,
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
          mustChangePassword: true,
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
            mustChangePassword: true,
          },
        },
        tx,
      );

      return user.id;
    });

    return this.getUser(createdUserId);
  }

  async updateUser(
    userId: string,
    dto: UpdateUserProfileRequest,
    actorUserId: string,
    requestId?: string | null,
    ipAddress?: string | null,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    });

    if (!user) {
      throw new NotFoundException('Usuario nao encontrado.');
    }

    const email = dto.email.trim().toLowerCase();
    if (email !== user.email) {
      const existing = await this.prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });
      if (existing && existing.id !== userId) {
        throw new ConflictException('Ja existe um usuario com este e-mail.');
      }
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        name: dto.name.trim(),
        email,
      },
    });

    await this.invalidateUserSessionCaches(userId);

    await this.auditService.record({
      actorId: actorUserId,
      actorType: 'user',
      action: 'iam.user.updated',
      resourceType: 'user',
      resourceId: userId,
      ipAddress,
      requestId,
      metadata: {
        previousName: user.name,
        nextName: dto.name.trim(),
        previousEmail: user.email,
        nextEmail: email,
      },
    });

    return this.getUser(userId);
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

      if (user.status === 'LOCKED') {
        throw new ConflictException('Use o fluxo de bloqueio/desbloqueio para usuarios bloqueados.');
      }

      const currentRoles = user.roles.map((userRole) => userRole.role.name);
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
          ...(dto.status === 'ACTIVE'
            ? {
                lockedAt: null,
                lockedUntil: null,
                lockReason: null,
                lockedByUserId: null,
              }
            : {}),
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

  async lockUser(
    userId: string,
    actorUserId: string,
    requestId?: string | null,
    ipAddress?: string | null,
  ) {
    if (userId === actorUserId) {
      throw new ForbiddenException('Nao e permitido bloquear a propria conta.');
    }

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

      const currentRoles = user.roles.map((userRole) => userRole.role.name);
      if (currentRoles.includes('owner')) {
        await this.ensureAnotherActiveOwnerExists(tx, user.id);
      }

      const activeSessions = await tx.session.findMany({
        where: {
          userId,
          status: 'ACTIVE',
        },
        select: {
          id: true,
        },
      });
      sessionIdsToEvict = activeSessions.map((session) => session.id);

      await tx.session.updateMany({
        where: {
          userId,
          status: 'ACTIVE',
        },
        data: {
          status: 'REVOKED',
          revokedAt: new Date(),
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: {
          status: 'LOCKED',
          lockedAt: new Date(),
          lockedUntil: null,
          lockReason: 'ADMIN',
          lockedByUserId: actorUserId,
        },
      });

      await this.auditService.record(
        {
          actorId: actorUserId,
          actorType: 'user',
          action: 'iam.user.locked',
          resourceType: 'user',
          resourceId: userId,
          ipAddress,
          requestId,
          metadata: {
            reason: 'ADMIN',
            revokedSessions: sessionIdsToEvict.length,
          },
        },
        tx,
      );
    });

    await this.evictSessionCaches(sessionIdsToEvict);

    return this.getUser(userId);
  }

  async unlockUser(
    userId: string,
    dto: UnlockUserRequest,
    actorUserId: string,
    requestId?: string | null,
    ipAddress?: string | null,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        status: true,
        lockReason: true,
        lockedUntil: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario nao encontrado.');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        status: 'ACTIVE',
        lockedAt: null,
        lockedUntil: null,
        lockReason: null,
        lockedByUserId: null,
      },
    });

    await this.invalidateUserSessionCaches(userId);

    await this.auditService.record({
      actorId: actorUserId,
      actorType: 'user',
      action: 'iam.user.unlocked',
      resourceType: 'user',
      resourceId: userId,
      ipAddress,
      requestId,
      metadata: {
        previousStatus: user.status,
        previousLockReason: user.lockReason,
        previousLockedUntil: user.lockedUntil?.toISOString() ?? null,
        note: dto.note ?? null,
      },
    });

    return this.getUser(userId);
  }

  async resetUserPassword(
    userId: string,
    dto: AdminResetPasswordRequest,
    actorUserId: string,
    requestId?: string | null,
    ipAddress?: string | null,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('Usuario nao encontrado.');
    }

    const passwordHash = await argon2.hash(dto.temporaryPassword, {
      type: argon2.argon2id,
    });
    let sessionIdsToEvict: string[] = [];

    await this.prisma.$transaction(async (tx) => {
      const activeSessions = await tx.session.findMany({
        where: {
          userId,
          status: 'ACTIVE',
        },
        select: {
          id: true,
        },
      });
      sessionIdsToEvict = activeSessions.map((session) => session.id);

      await tx.user.update({
        where: { id: userId },
        data: {
          passwordHash,
          mustChangePassword: true,
        },
      });

      await tx.session.updateMany({
        where: {
          userId,
          status: 'ACTIVE',
        },
        data: {
          status: 'REVOKED',
          revokedAt: new Date(),
        },
      });

      await this.auditService.record(
        {
          actorId: actorUserId,
          actorType: 'user',
          action: 'iam.user.password.reset',
          resourceType: 'user',
          resourceId: userId,
          ipAddress,
          requestId,
          metadata: {
            mustChangePassword: true,
            revokedSessions: sessionIdsToEvict.length,
          },
        },
        tx,
      );
    });

    await this.evictSessionCaches(sessionIdsToEvict);

    return {
      message: 'Senha temporaria redefinida com sucesso.',
    };
  }

  async replaceUserRoles(
    userId: string,
    dto: ReplaceIamUserRolesRequest,
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

      const currentRoles = user.roles.map((userRole) => userRole.role.name);
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

  async listScreens(): Promise<AppScreenItem[]> {
    await this.catalogSyncService.sync();

    const screens = await this.prisma.appScreen.findMany({
      where: {
        isActive: true,
      },
      orderBy: [{ area: 'asc' }, { group: 'asc' }, { sortOrder: 'asc' }, { title: 'asc' }],
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

    return screens.map((screen) => this.toScreenItem(screen));
  }

  private async findUserWithAccessOrThrow(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: this.userAccessInclude(),
    });

    if (!user) {
      throw new NotFoundException('Usuario nao encontrado.');
    }

    return user;
  }

  private async resolveRoleIds(roleNames: string[]) {
    const uniqueRoles = [...new Set(roleNames)];
    const roles = await this.prisma.role.findMany({
      where: {
        name: {
          in: uniqueRoles,
        },
        isActive: true,
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (roles.length !== uniqueRoles.length) {
      throw new NotFoundException('Uma ou mais roles informadas nao existem ou estao inativas.');
    }

    return uniqueRoles.map((roleName) => {
      const role = roles.find((candidate) => candidate.name === roleName);
      if (!role) {
        throw new NotFoundException('Uma ou mais roles informadas nao existem ou estao inativas.');
      }

      return role.id;
    });
  }

  private async resolvePermissionIds(permissionNames: string[]) {
    const uniquePermissions = [...new Set(permissionNames)];
    if (!uniquePermissions.length) {
      return [];
    }

    const permissions = await this.prisma.permission.findMany({
      where: {
        name: {
          in: uniquePermissions,
        },
        isActive: true,
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (permissions.length !== uniquePermissions.length) {
      throw new NotFoundException(
        'Uma ou mais permissoes informadas nao existem ou estao inativas.',
      );
    }

    return uniquePermissions.map((permissionName) => {
      const permission = permissions.find((candidate) => candidate.name === permissionName);
      if (!permission) {
        throw new NotFoundException(
          'Uma ou mais permissoes informadas nao existem ou estao inativas.',
        );
      }

      return permission.id;
    });
  }

  private async resolveScreenIds(screenKeys: string[]) {
    const uniqueScreenKeys = [...new Set(screenKeys)];
    if (!uniqueScreenKeys.length) {
      return [];
    }

    const screens = await this.prisma.appScreen.findMany({
      where: {
        key: {
          in: uniqueScreenKeys,
        },
        isActive: true,
      },
      select: {
        id: true,
        key: true,
      },
    });

    if (screens.length !== uniqueScreenKeys.length) {
      throw new NotFoundException('Uma ou mais telas informadas nao existem ou estao inativas.');
    }

    return uniqueScreenKeys.map((screenKey) => {
      const screen = screens.find((candidate) => candidate.key === screenKey);
      if (!screen) {
        throw new NotFoundException('Uma ou mais telas informadas nao existem ou estao inativas.');
      }

      return screen.id;
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
              isActive: true,
            },
          },
        },
      },
    });

    if (activeOwnerCount === 0) {
      throw new ForbiddenException(
        'Nao e permitido remover, inativar ou bloquear o ultimo owner ativo.',
      );
    }
  }

  private toScreenItem(
    screen: Prisma.AppScreenGetPayload<{
      include: {
        permissions: {
          include: {
            permission: true;
          };
        };
      };
    }>,
  ): AppScreenItem {
    return {
      id: screen.id,
      key: screen.key,
      path: screen.path,
      title: screen.title,
      description: screen.description ?? null,
      area: screen.area as AppArea,
      group: screen.group,
      sortOrder: screen.sortOrder,
      isActive: screen.isActive,
      isSystem: screen.isSystem,
      permissionNames: screen.permissions.map((permissionScreen) => permissionScreen.permission.name),
    };
  }

  private toPermissionItem(permission: PermissionListRow | PermissionWithScreens): IamPermissionItem {
    return {
      id: permission.id,
      name: permission.name,
      description: permission.description ?? null,
      scope: permission.scope,
      isSystem: permission.isSystem,
      isActive: permission.isActive,
      screens: permission.screens.map((permissionScreen) => permissionScreen.screen.key),
    };
  }

  private toPermissionDetail(permission: PermissionWithScreens): PermissionDetail {
    return {
      ...this.toPermissionItem(permission),
      screenItems: permission.screens.map((permissionScreen) =>
        this.toScreenItem({
          ...permissionScreen.screen,
          permissions: [],
        }),
      ),
    };
  }

  private toRoleItem(role: RoleListRow | RoleWithPermissions): IamRoleItem {
    return {
      id: role.id,
      name: role.name,
      description: role.description ?? null,
      scope: role.scope,
      isSystem: role.isSystem,
      isActive: role.isActive,
      permissions: role.permissions.map((rolePermission) => rolePermission.permission.name),
    };
  }

  private toRoleDetail(role: RoleWithPermissions): RoleDetail {
    return {
      ...this.toRoleItem(role),
      screens: [
        ...new Set(
          role.permissions.flatMap((rolePermission) =>
            rolePermission.permission.screens.map((permissionScreen) => permissionScreen.screen.key),
          ),
        ),
      ],
    };
  }

  private toIamUserListItem(user: UserListRow | UserWithAccess): IamUserListItem {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      status: user.status,
      roles: this.extractRoleNamesFromAssignments(user.roles),
      areas: this.extractAreasFromRoleAssignments(user.roles),
      mustChangePassword: user.mustChangePassword,
      lockReason: user.lockReason,
      lockedAt: user.lockedAt?.toISOString() ?? null,
      lockedUntil: user.lockedUntil?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    };
  }

  private toIamUserDetail(user: UserWithAccess): IamUserDetail {
    return {
      ...this.toIamUserListItem(user),
      permissions: this.extractPermissions(user),
    };
  }

  private extractRoleNamesFromAssignments(
    roles: Array<{
      role: {
        name: string;
        isActive: boolean;
      };
    }>,
  ) {
    return roles.filter((userRole) => userRole.role.isActive).map((userRole) => userRole.role.name);
  }

  private extractAreasFromRoleAssignments(
    roles: Array<{
      role: {
        scope: string;
        isActive: boolean;
      };
    }>,
  ) {
    const areas = new Set<AppArea>();

    for (const userRole of roles) {
      if (!userRole.role.isActive) {
        continue;
      }

      this.pushAreasFromScope(areas, userRole.role.scope);
    }

    return [...areas];
  }

  private extractRoles(user: UserWithAccess) {
    return user.roles
      .filter((userRole) => userRole.role.isActive)
      .map((userRole) => userRole.role.name);
  }

  private extractPermissions(user: UserWithAccess) {
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

  private extractAreas(user: UserWithAccess) {
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

  private async invalidateRoleUserSessionCaches(roleId: string) {
    const userIds = await this.prisma.userRole.findMany({
      where: {
        roleId,
      },
      select: {
        userId: true,
      },
    });

    await this.invalidateUsersSessionCaches(userIds.map((item) => item.userId));
  }

  private async invalidatePermissionSessionCaches(permissionId: string) {
    const userIds = await this.prisma.userRole.findMany({
      where: {
        role: {
          permissions: {
            some: {
              permissionId,
            },
          },
        },
      },
      select: {
        userId: true,
      },
    });

    await this.invalidateUsersSessionCaches(userIds.map((item) => item.userId));
  }

  private async invalidateUsersSessionCaches(userIds: string[]) {
    const uniqueUserIds = [...new Set(userIds)];
    if (!uniqueUserIds.length) {
      return;
    }

    const sessions = await this.prisma.session.findMany({
      where: {
        userId: {
          in: uniqueUserIds,
        },
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
