import { ApiProperty } from '@nestjs/swagger';
import type {
  AppScreenItem,
  IamPermissionItem,
  IamRoleItem,
  IamUserDetail,
  IamUserListItem,
  PaginatedResponse,
  PermissionDetail,
  RoleDetail,
  UserStatus,
} from '@financial-martec/contracts';
import { appAreas, permissionScopes, roleScopes, userLockReasons } from '@financial-martec/contracts';

const userStatuses: UserStatus[] = ['ACTIVE', 'INACTIVE', 'LOCKED'];

export class AppScreenItemDto implements AppScreenItem {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  key!: string;

  @ApiProperty()
  path!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ nullable: true })
  description!: string | null;

  @ApiProperty({ enum: appAreas })
  area!: (typeof appAreas)[number];

  @ApiProperty()
  group!: string;

  @ApiProperty()
  sortOrder!: number;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  isSystem!: boolean;

  @ApiProperty({ type: String, isArray: true })
  permissionNames!: string[];
}

export class IamPermissionItemDto implements IamPermissionItem {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ nullable: true })
  description!: string | null;

  @ApiProperty({ enum: permissionScopes })
  scope!: (typeof permissionScopes)[number];

  @ApiProperty()
  isSystem!: boolean;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({ type: String, isArray: true })
  screens!: string[];
}

export class PermissionDetailDto
  extends IamPermissionItemDto
  implements PermissionDetail
{
  @ApiProperty({ type: AppScreenItemDto, isArray: true })
  screenItems!: AppScreenItemDto[];
}

export class IamRoleItemDto implements IamRoleItem {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ nullable: true })
  description!: string | null;

  @ApiProperty({ enum: roleScopes })
  scope!: (typeof roleScopes)[number];

  @ApiProperty()
  isSystem!: boolean;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({ type: String, isArray: true })
  permissions!: string[];
}

export class RoleDetailDto extends IamRoleItemDto implements RoleDetail {
  @ApiProperty({ type: String, isArray: true })
  screens!: string[];
}

export class IamUserListItemDto implements IamUserListItem {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ enum: userStatuses })
  status!: UserStatus;

  @ApiProperty({ type: String, isArray: true })
  roles!: string[];

  @ApiProperty({ enum: appAreas, isArray: true })
  areas!: (typeof appAreas)[number][];

  @ApiProperty()
  mustChangePassword!: boolean;

  @ApiProperty({ enum: userLockReasons, nullable: true })
  lockReason!: (typeof userLockReasons)[number] | null;

  @ApiProperty({ nullable: true })
  lockedAt!: string | null;

  @ApiProperty({ nullable: true })
  lockedUntil!: string | null;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;

  @ApiProperty({ nullable: true })
  lastLoginAt!: string | null;
}

export class IamUserDetailDto extends IamUserListItemDto implements IamUserDetail {
  @ApiProperty({ type: String, isArray: true })
  permissions!: string[];
}

export class IamUsersPageDto implements PaginatedResponse<IamUserListItemDto> {
  @ApiProperty({ type: IamUserListItemDto, isArray: true })
  items!: IamUserListItemDto[];

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  totalPages!: number;
}
