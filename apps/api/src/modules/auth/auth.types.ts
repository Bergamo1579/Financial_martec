import type {
  AppPermission,
  AppRole,
  AppArea,
  AuthenticatedUser as BaseAuthenticatedUser,
  NavigationResponse,
  UserLockReason,
  UserStatus,
} from '@financial-martec/contracts';

export interface JwtPayload {
  sub: string;
  email: string;
  sessionId: string;
  roles: AppRole[];
  permissions: AppPermission[];
  areas: AppArea[];
  mustChangePassword: boolean;
}

export interface AuthenticatedUser extends BaseAuthenticatedUser {
  name: string;
  status: UserStatus;
  mfaEnabled: boolean;
  defaultPath: string;
  lockReason: UserLockReason | null;
  lockedUntil: string | null;
  navigation: NavigationResponse;
}
