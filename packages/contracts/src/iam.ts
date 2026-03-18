import type { AppPermission } from './permissions';
import type { AppRole } from './roles';
import type { UserStatus } from './auth';

export interface IamPermissionItem {
  name: AppPermission;
  description: string | null;
}

export interface IamRoleItem {
  name: AppRole;
  description: string | null;
  permissions: AppPermission[];
}

export interface IamUserListItem {
  id: string;
  name: string;
  email: string;
  status: UserStatus;
  roles: AppRole[];
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

export interface IamUserDetail extends IamUserListItem {
  permissions: AppPermission[];
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
