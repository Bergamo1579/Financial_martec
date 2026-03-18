import 'dotenv/config';
import argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';
import { permissions, rolePermissions, roles } from '@financial-martec/contracts';

const prisma = new PrismaClient();

const permissionDescriptions: Record<(typeof permissions)[number], string> = {
  'companies.read': 'Visualizar empresas sincronizadas do pedagogico',
  'students.read': 'Visualizar alunos sincronizados do pedagogico',
  'audit.read': 'Visualizar eventos de auditoria',
  'sync.manage': 'Disparar sincronizacao manual do pedagogico',
  'iam.users.read': 'Visualizar usuarios internos e seus perfis',
  'iam.users.manage': 'Criar usuarios internos e atualizar status/perfis',
  'iam.roles.read': 'Visualizar catalogo de perfis e permissoes',
};

async function main() {
  for (const permissionName of permissions) {
    await prisma.permission.upsert({
      where: { name: permissionName },
      update: { description: permissionDescriptions[permissionName] },
      create: {
        name: permissionName,
        description: permissionDescriptions[permissionName],
      },
    });
  }

  for (const roleName of roles) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {
        description: `Perfil padrao ${roleName} do Financial Martec`,
      },
      create: {
        name: roleName,
        description: `Perfil padrao ${roleName} do Financial Martec`,
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
    },
    create: {
      name: bootstrapName,
      email: bootstrapEmail,
      passwordHash,
      status: 'ACTIVE',
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
