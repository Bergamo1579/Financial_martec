import type { AppRole } from './roles';

export const permissions = [
  'companies.read',
  'students.read',
  'audit.read',
  'sync.manage',
  'iam.users.read',
  'iam.users.manage',
  'iam.roles.read',
] as const;

export type AppPermission = (typeof permissions)[number];

export const rolePermissions: Record<AppRole, AppPermission[]> = {
  owner: [...permissions],
  admin_financeiro: ['companies.read', 'students.read', 'audit.read', 'sync.manage'],
  analista_financeiro: ['companies.read', 'students.read'],
  auditor: ['companies.read', 'students.read', 'audit.read'],
};
