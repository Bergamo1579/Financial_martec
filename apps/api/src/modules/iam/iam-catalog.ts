import type { AppArea, PermissionScope, RoleScope } from '@financial-martec/contracts';
import type { AppPermission } from '@financial-martec/contracts';

export const permissionDescriptions: Record<AppPermission, string> = {
  'companies.read': 'Visualizar empresas sincronizadas do pedagogico',
  'students.read': 'Visualizar alunos sincronizados do pedagogico',
  'audit.read': 'Visualizar eventos de auditoria',
  'sync.manage': 'Disparar sincronizacao manual do pedagogico',
  'iam.users.read': 'Visualizar usuarios internos e seus perfis',
  'iam.users.manage': 'Criar usuarios internos e atualizar status/perfis',
  'iam.roles.read': 'Visualizar catalogo de perfis e permissoes',
  'iam.roles.manage': 'Criar e editar perfis administrativos e de aplicacao',
  'iam.permissions.read': 'Visualizar catalogo de permissoes e telas registradas',
  'iam.permissions.manage': 'Criar e editar permissoes e seu vinculo com telas',
  'app.workspace.read': 'Acessar a area principal de trabalho da aplicacao',
  'app.profile.read': 'Acessar a area de perfil do usuario na aplicacao',
  'app.cadastros.view': 'Visualizar lista e detalhe dos cadastros operacionais',
  'app.cadastros.manage': 'Criar, editar, indicar, arquivar e excluir cadastros quando permitido',
  'app.matriculas.view': 'Visualizar matriculas vindas do pedagogico na area comum',
  'app.empresas.view': 'Visualizar empresas vindas do pedagogico na area comum',
  'app.empresas.manage-indicacoes': 'Operar indicacoes de cadastros nas empresas',
  'app.planos-pagamento.view': 'Visualizar o catalogo de planos de pagamento',
  'app.planos-pagamento.manage': 'Criar, editar, ativar e inativar planos de pagamento',
};

export const permissionScopes: Record<AppPermission, PermissionScope> = {
  'companies.read': 'BACKOFFICE',
  'students.read': 'BACKOFFICE',
  'audit.read': 'BACKOFFICE',
  'sync.manage': 'BACKOFFICE',
  'iam.users.read': 'BACKOFFICE',
  'iam.users.manage': 'BACKOFFICE',
  'iam.roles.read': 'BACKOFFICE',
  'iam.roles.manage': 'BACKOFFICE',
  'iam.permissions.read': 'BACKOFFICE',
  'iam.permissions.manage': 'BACKOFFICE',
  'app.workspace.read': 'APP',
  'app.profile.read': 'APP',
  'app.cadastros.view': 'APP',
  'app.cadastros.manage': 'APP',
  'app.matriculas.view': 'APP',
  'app.empresas.view': 'APP',
  'app.empresas.manage-indicacoes': 'APP',
  'app.planos-pagamento.view': 'APP',
  'app.planos-pagamento.manage': 'APP',
};

export const roleScopes: Record<string, RoleScope> = {
  owner: 'BOTH',
  admin_financeiro: 'BACKOFFICE',
  analista_financeiro: 'BACKOFFICE',
  auditor: 'BACKOFFICE',
  usuario_app: 'APP',
  operador_area_comum: 'APP',
};

export const screenDefinitions: Array<{
  key: string;
  path: string;
  title: string;
  description: string;
  area: AppArea;
  group: string;
  sortOrder: number;
  permissions: AppPermission[];
}> = [
  {
    key: 'backoffice.home',
    path: '/backoffice',
    title: 'Visao geral',
    description: 'Painel operacional do backoffice',
    area: 'BACKOFFICE',
    group: 'Backoffice',
    sortOrder: 0,
    permissions: ['companies.read'],
  },
  {
    key: 'backoffice.empresas',
    path: '/backoffice/empresas',
    title: 'Empresas',
    description: 'Consulta operacional de empresas sincronizadas',
    area: 'BACKOFFICE',
    group: 'Backoffice',
    sortOrder: 10,
    permissions: ['companies.read'],
  },
  {
    key: 'backoffice.alunos',
    path: '/backoffice/alunos',
    title: 'Alunos',
    description: 'Consulta operacional de alunos sincronizados',
    area: 'BACKOFFICE',
    group: 'Backoffice',
    sortOrder: 20,
    permissions: ['students.read'],
  },
  {
    key: 'backoffice.usuarios',
    path: '/backoffice/usuarios',
    title: 'Usuarios',
    description: 'Gestao administrativa de usuarios',
    area: 'BACKOFFICE',
    group: 'Administracao',
    sortOrder: 30,
    permissions: ['iam.users.read'],
  },
  {
    key: 'backoffice.roles',
    path: '/backoffice/roles',
    title: 'Roles',
    description: 'Catalogo e atribuicao de roles',
    area: 'BACKOFFICE',
    group: 'Administracao',
    sortOrder: 40,
    permissions: ['iam.roles.read'],
  },
  {
    key: 'backoffice.permissions',
    path: '/backoffice/permissoes',
    title: 'Permissoes',
    description: 'Catalogo de permissoes e telas vinculadas',
    area: 'BACKOFFICE',
    group: 'Administracao',
    sortOrder: 50,
    permissions: ['iam.permissions.read'],
  },
  {
    key: 'app-cadastros',
    path: '/app/cadastros',
    title: 'Cadastro',
    description: 'Fluxo operacional de pre-cadastro e indicacoes',
    area: 'APP',
    group: 'Area comum',
    sortOrder: 0,
    permissions: ['app.cadastros.view'],
  },
  {
    key: 'app-matriculas',
    path: '/app/matriculas',
    title: 'Matriculas',
    description: 'Leitura operacional das matriculas do pedagogico',
    area: 'APP',
    group: 'Area comum',
    sortOrder: 10,
    permissions: ['app.matriculas.view'],
  },
  {
    key: 'app-empresas',
    path: '/app/empresas',
    title: 'Empresas',
    description: 'Consulta de empresas e operacao de indicacoes',
    area: 'APP',
    group: 'Area comum',
    sortOrder: 20,
    permissions: ['app.empresas.view'],
  },
  {
    key: 'app-planos-pagamento',
    path: '/app/planos-pagamento',
    title: 'Planos de pagamento',
    description: 'Catalogo local de planos de pagamento',
    area: 'APP',
    group: 'Area comum',
    sortOrder: 30,
    permissions: ['app.planos-pagamento.view'],
  },
];

export const inactiveScreenKeys = ['app.home', 'app.workspace', 'app.profile'];
