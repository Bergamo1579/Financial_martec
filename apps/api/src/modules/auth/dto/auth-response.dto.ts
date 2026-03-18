import { ApiProperty } from '@nestjs/swagger';
import { permissions, roles } from '@financial-martec/contracts';
import type {
  AuthUserResponse,
  SessionItem,
  SessionStatus,
  UserStatus,
} from '@financial-martec/contracts';

const userStatuses: UserStatus[] = ['ACTIVE', 'INACTIVE', 'LOCKED'];
const sessionStatuses: SessionStatus[] = ['ACTIVE', 'REVOKED', 'EXPIRED'];

export class AuthUserDto implements AuthUserResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ enum: roles, isArray: true })
  roles!: (typeof roles)[number][];

  @ApiProperty({ enum: permissions, isArray: true })
  permissions!: (typeof permissions)[number][];

  @ApiProperty({ enum: userStatuses })
  status!: UserStatus;

  @ApiProperty()
  mfaEnabled!: boolean;
}

export class AuthPayloadDto {
  @ApiProperty({ type: AuthUserDto })
  user!: AuthUserDto;
}

export class MessageResponseDto {
  @ApiProperty()
  message!: string;
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
