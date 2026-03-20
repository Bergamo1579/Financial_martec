import type {
  AppPermission,
  AppRole,
  AppArea,
  NavigationResponse,
  UserLockReason,
  UserStatus,
} from '@financial-martec/contracts';
import type { AuthenticatedUser } from './auth.types';

export interface CachedSessionAuthContext {
  sessionId: string;
  userId: string;
  name: string;
  email: string;
  status: UserStatus;
  mfaEnabled: boolean;
  roles: AppRole[];
  permissions: AppPermission[];
  areas: AppArea[];
  mustChangePassword: boolean;
  defaultPath: string;
  lockReason: UserLockReason | null;
  lockedUntil: string | null;
  navigation: NavigationResponse;
  expiresAt: string;
}

export function buildSessionCacheKey(sessionId: string) {
  return `session:${sessionId}`;
}

export function toAuthenticatedUser(
  cachedContext: CachedSessionAuthContext,
): AuthenticatedUser {
  return {
    id: cachedContext.userId,
    name: cachedContext.name,
    email: cachedContext.email,
    sessionId: cachedContext.sessionId,
    status: cachedContext.status,
    mfaEnabled: cachedContext.mfaEnabled,
    roles: cachedContext.roles,
    permissions: cachedContext.permissions,
    areas: cachedContext.areas,
    mustChangePassword: cachedContext.mustChangePassword,
    defaultPath: cachedContext.defaultPath,
    lockReason: cachedContext.lockReason,
    lockedUntil: cachedContext.lockedUntil,
    navigation: cachedContext.navigation,
  };
}
