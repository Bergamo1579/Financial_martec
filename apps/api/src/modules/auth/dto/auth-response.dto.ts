import { ApiProperty } from '@nestjs/swagger';
import type {
  AuthBootstrapResponse,
  AuthUserResponse,
  NavigationItem,
  NavigationResponse,
  SessionItem,
  SessionStatus,
  UserStatus,
} from '@financial-martec/contracts';
import { appAreas, userLockReasons } from '@financial-martec/contracts';

const userStatuses: UserStatus[] = ['ACTIVE', 'INACTIVE', 'LOCKED'];
const sessionStatuses: SessionStatus[] = ['ACTIVE', 'REVOKED', 'EXPIRED'];

export class AuthUserDto implements AuthUserResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ type: String, isArray: true })
  roles!: string[];

  @ApiProperty({ type: String, isArray: true })
  permissions!: string[];

  @ApiProperty({ enum: appAreas, isArray: true })
  areas!: (typeof appAreas)[number][];

  @ApiProperty({ enum: userStatuses })
  status!: UserStatus;

  @ApiProperty()
  mfaEnabled!: boolean;

  @ApiProperty()
  mustChangePassword!: boolean;

  @ApiProperty()
  defaultPath!: string;

  @ApiProperty({ enum: userLockReasons, nullable: true })
  lockReason!: (typeof userLockReasons)[number] | null;

  @ApiProperty({ nullable: true })
  lockedUntil!: string | null;
}

export class AuthPayloadDto {
  @ApiProperty({ type: AuthUserDto })
  user!: AuthUserDto;
}

export class MessageResponseDto {
  @ApiProperty()
  message!: string;
}

export class NavigationItemDto implements NavigationItem {
  @ApiProperty()
  key!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  path!: string;

  @ApiProperty()
  group!: string;

  @ApiProperty({ enum: appAreas })
  area!: (typeof appAreas)[number];

  @ApiProperty({ type: String, isArray: true })
  permissions!: string[];
}

export class NavigationResponseDto implements NavigationResponse {
  @ApiProperty({ type: NavigationItemDto, isArray: true })
  items!: NavigationItemDto[];

  @ApiProperty({ enum: appAreas, isArray: true })
  areas!: (typeof appAreas)[number][];

  @ApiProperty()
  defaultPath!: string;
}

export class AuthBootstrapDto implements AuthBootstrapResponse {
  @ApiProperty({ type: AuthUserDto })
  user!: AuthUserDto;

  @ApiProperty({ type: NavigationResponseDto })
  navigation!: NavigationResponseDto;
}

export class SessionItemDto implements SessionItem {
  @ApiProperty()
  id!: string;

  @ApiProperty({ nullable: true })
  userAgent!: string | null;

  @ApiProperty({ nullable: true })
  ipAddress!: string | null;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;

  @ApiProperty()
  expiresAt!: string;

  @ApiProperty({ nullable: true })
  lastUsedAt!: string | null;

  @ApiProperty({ nullable: true })
  revokedAt!: string | null;

  @ApiProperty({ enum: sessionStatuses })
  status!: SessionStatus;

  @ApiProperty()
  current!: boolean;
}
