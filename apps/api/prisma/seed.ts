import 'dotenv/config';
import argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';
import { roles } from '@financial-martec/contracts';

const prisma = new PrismaClient();

const permissions = [
  {
    name: 'companies.read',
    description: 'Visualizar empresas sincronizadas do pedagógico',
  },
  {
    name: 'students.read',
    description: 'Visualizar alunos sincronizados do pedagógico',
  },
  {
    name: 'audit.read',
    description: 'Visualizar eventos de auditoria',
  },
  {
    name: 'sync.manage',
    description: 'Disparar sincronização manual do pedagógico',
  },
];

const rolePermissionMap: Record<(typeof roles)[number], string[]> = {
  owner: permissions.map((permission) => permission.name),
  admin_financeiro: ['companies.read', 'students.read', 'audit.read', 'sync.manage'],
  analista_financeiro: ['companies.read', 'students.read'],
  auditor: ['companies.read', 'students.read', 'audit.read'],
};

async function main() {
  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: { name: permission.name },
      update: { description: permission.description },
      create: permission,
    });
  }

  for (const roleName of roles) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {
        description: `Perfil padrão ${roleName} do Financial Martec`,
      },
      create: {
        name: roleName,
        description: `Perfil padrão ${roleName} do Financial Martec`,
      },
    });

    for (const permissionName of rolePermissionMap[roleName]) {
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
