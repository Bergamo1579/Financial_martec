export const roles = [
  'owner',
  'admin_financeiro',
  'analista_financeiro',
  'auditor',
] as const;

export type AppRole = (typeof roles)[number];
