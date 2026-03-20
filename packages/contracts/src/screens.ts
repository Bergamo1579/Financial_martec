import type { AppArea } from './identity';

export interface AppScreenItem {
  id: string;
  key: string;
  path: string;
  title: string;
  description: string | null;
  area: AppArea;
  group: string;
  sortOrder: number;
  isActive: boolean;
  isSystem: boolean;
  permissionNames: string[];
}
