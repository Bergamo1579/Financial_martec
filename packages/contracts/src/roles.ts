export const systemRoles = [
  'owner',
  'admin_financeiro',
  'analista_financeiro',
  'auditor',
  'usuario_app',
  'operador_area_comum',
] as const;

export const roles = systemRoles;

export type AppRole = string;
