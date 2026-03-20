import type { AppPermission } from './permissions';
import type { AppRole } from './roles';
import type { AppArea, UserLockReason } from './identity';

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'LOCKED';
export type SessionStatus = 'ACTIVE' | 'REVOKED' | 'EXPIRED';

export interface AuthenticatedUser {
  id: string;
  email: string;
  sessionId: string;
  roles: AppRole[];
  permissions: AppPermission[];
  areas: AppArea[];
  mustChangePassword: boolean;
}

export interface AuthUserResponse {
  id: string;
  name: string;
  email: string;
  roles: AppRole[];
  permissions: AppPermission[];
  areas: AppArea[];
  status: UserStatus;
  mfaEnabled: boolean;
  mustChangePassword: boolean;
  defaultPath: string;
  lockReason: UserLockReason | null;
  lockedUntil: string | null;
}

export interface SessionItem {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  status: SessionStatus;
  current: boolean;
}

export interface NavigationItem {
  key: string;
  title: string;
  path: string;
  group: string;
  area: AppArea;
  permissions: AppPermission[];
}

export interface NavigationResponse {
  items: NavigationItem[];
  areas: AppArea[];
  defaultPath: string;
}

export interface AuthBootstrapResponse {
  user: AuthUserResponse;
  navigation: NavigationResponse;
}
