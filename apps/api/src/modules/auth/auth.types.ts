import type { AppRole } from '@financial-martec/contracts';

export interface JwtPayload {
  sub: string;
  email: string;
  sessionId: string;
  roles: AppRole[];
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  sessionId: string;
  roles: AppRole[];
}
