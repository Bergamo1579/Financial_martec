import { SetMetadata } from '@nestjs/common';
import type { AppPermission } from '@financial-martec/contracts';

export const PERMISSIONS_KEY = 'permissions';

export const Permissions = (...permissions: AppPermission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
