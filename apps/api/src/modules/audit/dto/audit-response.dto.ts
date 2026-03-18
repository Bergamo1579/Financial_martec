import { ApiProperty } from '@nestjs/swagger';
import type {
  AuditAction,
  AuditActorUser,
  AuditEventItem,
  PaginatedResponse,
} from '@financial-martec/contracts';

export class AuditActorUserDto implements AuditActorUser {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  email!: string;
}

export class AuditEventItemDto implements AuditEventItem {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  actorType!: 'user' | 'system';

  @ApiProperty({ type: AuditActorUserDto, nullable: true })
  actorUser!: AuditActorUserDto | null;

  @ApiProperty()
  action!: AuditAction;

  @ApiProperty()
  resourceType!: string;

  @ApiProperty({ nullable: true })
  resourceId!: string | null;

  @ApiProperty({ nullable: true })
  ipAddress!: string | null;

  @ApiProperty({ nullable: true })
  requestId!: string | null;

  @ApiProperty({ nullable: true })
  metadata!: Record<string, unknown> | null;

  @ApiProperty()
  createdAt!: string;
}

export class AuditEventsPageDto implements PaginatedResponse<AuditEventItemDto> {
  @ApiProperty({ type: AuditEventItemDto, isArray: true })
  items!: AuditEventItemDto[];

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  totalPages!: number;
}
