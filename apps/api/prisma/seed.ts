import 'dotenv/config';
import argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';
import {
  permissions,
  rolePermissions,
  roles,
} from '@financial-martec/contracts';
import {
  inactiveScreenKeys,
  permissionDescriptions,
  permissionScopes,
  roleScopes,
  screenDefinitions as screens,
} from '../src/modules/iam/iam-catalog';

const prisma = new PrismaClient();

async function main() {
  for (const permissionName of permissions) {
    await prisma.permission.upsert({
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
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {
        description: `Perfil padrao ${roleName} do Financial Martec`,
        scope: roleScopes[roleName],
        isSystem: true,
        isActive: true,
      },
      create: {
        name: roleName,
        description: `Perfil padrao ${roleName} do Financial Martec`,
        scope: roleScopes[roleName],
        isSystem: true,
        isActive: true,
      },
    });

    for (const permissionName of rolePermissions[roleName]) {
      const permission = await prisma.permission.findUniqueOrThrow({
        where: { name: permissionName },
      });

      await prisma.rolePermission.upsert({
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

  for (const screenDefinition of screens) {
    const screen = await prisma.appScreen.upsert({
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
      const permission = await prisma.permission.findUniqueOrThrow({
        where: { name: permissionName },
      });

      await prisma.permissionScreen.upsert({
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

  await prisma.appScreen.updateMany({
    where: {
      key: {
        in: inactiveScreenKeys,
      },
    },
    data: {
      isActive: false,
    },
  });

  const bootstrapEmail = process.env.ADMIN_BOOTSTRAP_EMAIL;
  const bootstrapPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  const bootstrapName = process.env.ADMIN_BOOTSTRAP_NAME ?? 'Owner Financial Martec';

  if (!bootstrapEmail || !bootstrapPassword) {
    console.warn('ADMIN_BOOTSTRAP_EMAIL ou ADMIN_BOOTSTRAP_PASSWORD ausentes; seed do owner ignorado.');
    return;
  }

  const ownerRole = await prisma.role.findUniqueOrThrow({
    where: { name: 'owner' },
  });

  const passwordHash = await argon2.hash(bootstrapPassword, {
    type: argon2.argon2id,
  });

  const user = await prisma.user.upsert({
    where: { email: bootstrapEmail },
    update: {
      name: bootstrapName,
      passwordHash,
      status: 'ACTIVE',
      mustChangePassword: false,
      lockedAt: null,
      lockedUntil: null,
      lockReason: null,
      lockedByUserId: null,
    },
    create: {
      name: bootstrapName,
      email: bootstrapEmail,
      passwordHash,
      status: 'ACTIVE',
      mustChangePassword: false,
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: user.id,
        roleId: ownerRole.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      roleId: ownerRole.id,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
