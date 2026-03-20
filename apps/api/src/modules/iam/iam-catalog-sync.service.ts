import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { permissions, rolePermissions, roles } from '@financial-martec/contracts';
import { PrismaService } from '@/common/prisma/prisma.service';
import {
  inactiveScreenKeys,
  permissionDescriptions,
  permissionScopes,
  roleScopes,
  screenDefinitions,
} from './iam-catalog';

@Injectable()
export class IamCatalogSyncService implements OnApplicationBootstrap {
  private readonly logger = new Logger(IamCatalogSyncService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap() {
    await this.sync();
  }

  async sync() {
    for (const permissionName of permissions) {
      await this.prisma.permission.upsert({
        where: { name: permissionName },
        update: {
          description: permissionDescriptions[permissionName],
          scope: permissionScopes[permissionName],
          isSystem: true,
          isActive: true,
        },
        create: {
          name: permissionName,
          description: permissionDescriptions[permissionName],
          scope: permissionScopes[permissionName],
          isSystem: true,
          isActive: true,
        },
      });
    }

    for (const roleName of roles) {
      const role = await this.prisma.role.upsert({
        where: { name: roleName },
        update: {
          description: `Perfil padrao ${roleName} do Financial Martec`,
          scope: roleScopes[roleName] ?? 'BOTH',
          isSystem: true,
          isActive: true,
        },
        create: {
          name: roleName,
          description: `Perfil padrao ${roleName} do Financial Martec`,
          scope: roleScopes[roleName] ?? 'BOTH',
          isSystem: true,
          isActive: true,
        },
      });

      for (const permissionName of rolePermissions[roleName]) {
        const permission = await this.prisma.permission.findUniqueOrThrow({
          where: { name: permissionName },
        });

        await this.prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: permission.id,
            },
          },
          update: {},
          create: {
            roleId: role.id,
            permissionId: permission.id,
          },
        });
      }
    }

    for (const screenDefinition of screenDefinitions) {
      const screen = await this.prisma.appScreen.upsert({
        where: { key: screenDefinition.key },
        update: {
          path: screenDefinition.path,
          title: screenDefinition.title,
          description: screenDefinition.description,
          area: screenDefinition.area,
          group: screenDefinition.group,
          sortOrder: screenDefinition.sortOrder,
          isActive: true,
          isSystem: true,
        },
        create: {
          key: screenDefinition.key,
          path: screenDefinition.path,
          title: screenDefinition.title,
          description: screenDefinition.description,
          area: screenDefinition.area,
          group: screenDefinition.group,
          sortOrder: screenDefinition.sortOrder,
          isActive: true,
          isSystem: true,
        },
      });

      for (const permissionName of screenDefinition.permissions) {
        const permission = await this.prisma.permission.findUniqueOrThrow({
          where: { name: permissionName },
        });

        await this.prisma.permissionScreen.upsert({
          where: {
            permissionId_screenId: {
              permissionId: permission.id,
              screenId: screen.id,
            },
          },
          update: {},
          create: {
            permissionId: permission.id,
            screenId: screen.id,
          },
        });
      }
    }

    await this.prisma.appScreen.updateMany({
      where: {
        key: {
          in: inactiveScreenKeys,
        },
      },
      data: {
        isActive: false,
      },
    });

    this.logger.debug('IAM system catalog synchronized.');
  }
}
