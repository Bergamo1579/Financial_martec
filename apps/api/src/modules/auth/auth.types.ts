import type {
  AppPermission,
  AppRole,
  AuthenticatedUser,
} from '@financial-martec/contracts';

export interface JwtPayload {
  sub: string;
  email: string;
  sessionId: string;
  roles: AppRole[];
  permissions: AppPermission[];
}

export type { AuthenticatedUser };
