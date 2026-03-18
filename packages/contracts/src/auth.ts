import type { AppPermission } from './permissions';
import type { AppRole } from './roles';

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'LOCKED';
export type SessionStatus = 'ACTIVE' | 'REVOKED' | 'EXPIRED';

export interface AuthenticatedUser {
  id: string;
  email: string;
  sessionId: string;
  roles: AppRole[];
  permissions: AppPermission[];
}

export interface AuthUserResponse {
  id: string;
  name: string;
  email: string;
  roles: AppRole[];
  permissions: AppPermission[];
  status: UserStatus;
  mfaEnabled: boolean;
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
