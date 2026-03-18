import { ApiProperty } from '@nestjs/swagger';
import type {
  AppPermission,
  AppRole,
  IamPermissionItem,
  IamRoleItem,
  IamUserDetail,
  IamUserListItem,
  PaginatedResponse,
  UserStatus,
} from '@financial-martec/contracts';

const appRoles: AppRole[] = ['owner', 'admin_financeiro', 'analista_financeiro', 'auditor'];
const userStatuses: UserStatus[] = ['ACTIVE', 'INACTIVE', 'LOCKED'];

export class IamPermissionItemDto implements IamPermissionItem {
  @ApiProperty()
  name!: AppPermission;

  @ApiProperty({ nullable: true })
  description!: string | null;
}

export class IamRoleItemDto implements IamRoleItem {
  @ApiProperty({ enum: appRoles })
  name!: AppRole;

  @ApiProperty({ nullable: true })
  description!: string | null;

  @ApiProperty({ type: String, isArray: true })
  permissions!: AppPermission[];
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
  roles!: AppRole[];

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;

  @ApiProperty({ nullable: true })
  lastLoginAt!: string | null;
}

export class IamUserDetailDto extends IamUserListItemDto implements IamUserDetail {
  @ApiProperty({ type: String, isArray: true })
  permissions!: AppPermission[];
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
