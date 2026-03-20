export const appAreas = ['BACKOFFICE', 'APP'] as const;
export type AppArea = (typeof appAreas)[number];

export const roleScopes = ['BACKOFFICE', 'APP', 'BOTH'] as const;
export type RoleScope = (typeof roleScopes)[number];

export const permissionScopes = ['BACKOFFICE', 'APP', 'BOTH'] as const;
export type PermissionScope = (typeof permissionScopes)[number];

export const userLockReasons = ['FAILED_ATTEMPTS', 'ADMIN'] as const;
export type UserLockReason = (typeof userLockReasons)[number];
