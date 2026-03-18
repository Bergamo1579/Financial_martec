import type {
  AppPermission,
  AppRole,
  AuthenticatedUser,
  UserStatus,
} from '@financial-martec/contracts';

export interface CachedSessionAuthContext {
  sessionId: string;
  userId: string;
  email: string;
  status: UserStatus;
  roles: AppRole[];
  permissions: AppPermission[];
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
    email: cachedContext.email,
    sessionId: cachedContext.sessionId,
    roles: cachedContext.roles,
    permissions: cachedContext.permissions,
  };
}
