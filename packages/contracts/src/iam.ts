import type { AppPermission } from './permissions';
import type { AppRole } from './roles';
import type { UserStatus } from './auth';
import type { AppArea, PermissionScope, RoleScope, UserLockReason } from './identity';
import type { AppScreenItem } from './screens';

export interface IamPermissionItem {
  id: string;
  name: AppPermission;
  description: string | null;
  scope: PermissionScope;
  isSystem: boolean;
  isActive: boolean;
  screens: string[];
}

export interface IamRoleItem {
  id: string;
  name: AppRole;
  description: string | null;
  scope: RoleScope;
  isSystem: boolean;
  isActive: boolean;
  permissions: AppPermission[];
}

export interface IamUserListItem {
  id: string;
  name: string;
  email: string;
  status: UserStatus;
  roles: AppRole[];
  areas: AppArea[];
  mustChangePassword: boolean;
  lockReason: UserLockReason | null;
  lockedAt: string | null;
  lockedUntil: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

export interface IamUserDetail extends IamUserListItem {
  permissions: AppPermission[];
}

export interface RoleDetail extends IamRoleItem {
  screens: string[];
}

export interface PermissionDetail extends IamPermissionItem {
  screenItems: AppScreenItem[];
}

export interface CreateIamUserRequest {
  name: string;
  email: string;
  password: string;
  roles: AppRole[];
  status?: Extract<UserStatus, 'ACTIVE' | 'INACTIVE'>;
}

export interface UpdateIamUserStatusRequest {
  status: Extract<UserStatus, 'ACTIVE' | 'INACTIVE'>;
}

export interface ReplaceIamUserRolesRequest {
  roles: AppRole[];
}

export interface UpdateUserProfileRequest {
  name: string;
  email: string;
}

export interface AdminResetPasswordRequest {
  temporaryPassword: string;
}

export interface UnlockUserRequest {
  note?: string;
}

export interface CreateRoleRequest {
  name: string;
  description?: string;
  scope: RoleScope;
}

export interface UpdateRoleRequest {
  name?: string;
  description?: string | null;
  scope?: RoleScope;
  isActive?: boolean;
}

export interface ReplaceRolePermissionsRequest {
  permissions: AppPermission[];
}

export interface CreatePermissionRequest {
  name: string;
  description?: string;
  scope: PermissionScope;
}

export interface UpdatePermissionRequest {
  name?: string;
  description?: string | null;
  scope?: PermissionScope;
  isActive?: boolean;
}

export interface ReplacePermissionScreensRequest {
  screens: string[];
}
