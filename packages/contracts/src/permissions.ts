import type { AppRole } from './roles';

export const systemPermissions = [
  'companies.read',
  'students.read',
  'audit.read',
  'sync.manage',
  'iam.users.read',
  'iam.users.manage',
  'iam.roles.read',
  'iam.roles.manage',
  'iam.permissions.read',
  'iam.permissions.manage',
  'app.workspace.read',
  'app.profile.read',
  'app.cadastros.view',
  'app.cadastros.manage',
  'app.matriculas.view',
  'app.empresas.view',
  'app.empresas.manage-indicacoes',
  'app.planos-pagamento.view',
  'app.planos-pagamento.manage',
] as const;

export const permissions = systemPermissions;

export type AppPermission = string;

export const rolePermissions: Record<AppRole, AppPermission[]> = {
  owner: [...permissions],
  admin_financeiro: [
    'companies.read',
    'students.read',
    'audit.read',
    'sync.manage',
    'iam.users.read',
    'iam.roles.read',
    'iam.permissions.read',
  ],
  analista_financeiro: ['companies.read', 'students.read'],
  auditor: ['companies.read', 'students.read', 'audit.read'],
  usuario_app: [
    'app.workspace.read',
    'app.profile.read',
    'app.cadastros.view',
    'app.matriculas.view',
    'app.empresas.view',
    'app.planos-pagamento.view',
  ],
  operador_area_comum: [
    'app.cadastros.view',
    'app.cadastros.manage',
    'app.matriculas.view',
    'app.empresas.view',
    'app.empresas.manage-indicacoes',
    'app.planos-pagamento.view',
    'app.planos-pagamento.manage',
  ],
};
