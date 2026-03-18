import { ApiProperty } from '@nestjs/swagger';
import type {
  PaginatedResponse,
  SyncIssueItem,
  SyncIssueResolutionType,
  SyncIssueSeverity,
  SyncIssueStateItem,
  SyncIssueStateStatus,
  SyncOverview,
  SyncRunDetail,
  SyncRunListItem,
  SyncRunStatus,
  SyncRunTriggerUser,
} from '@financial-martec/contracts';

const syncRunStatuses: SyncRunStatus[] = ['PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'PARTIAL'];
const syncIssueSeverities: SyncIssueSeverity[] = ['INFO', 'WARNING', 'ERROR'];
const syncIssueStateStatuses: SyncIssueStateStatus[] = ['open', 'resolved'];
const syncIssueResolutionTypes: SyncIssueResolutionType[] = ['AUTO_SYNC', 'MANUAL'];

export class SyncRunTriggerUserDto implements SyncRunTriggerUser {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  email!: string;
}

export class SyncIssueItemDto implements SyncIssueItem {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  entityType!: string;

  @ApiProperty({ nullable: true })
  entitySourceId!: string | null;

  @ApiProperty({ enum: syncIssueSeverities })
  severity!: SyncIssueSeverity;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  message!: string;

  @ApiProperty({ nullable: true })
  metadata!: Record<string, unknown> | null;

  @ApiProperty()
  createdAt!: string;
}

export class SyncIssueStateItemDto implements SyncIssueStateItem {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  fingerprint!: string;

  @ApiProperty()
  entityType!: string;

  @ApiProperty({ nullable: true })
  entitySourceId!: string | null;

  @ApiProperty()
  code!: string;

  @ApiProperty({ enum: syncIssueSeverities })
  severity!: SyncIssueSeverity;

  @ApiProperty()
  message!: string;

  @ApiProperty({ nullable: true })
  metadata!: Record<string, unknown> | null;

  @ApiProperty({ enum: syncIssueStateStatuses })
  status!: SyncIssueStateStatus;

  @ApiProperty()
  openedAt!: string;

  @ApiProperty()
  lastSeenAt!: string;

  @ApiProperty({ nullable: true })
  resolvedAt!: string | null;

  @ApiProperty({ enum: syncIssueResolutionTypes, nullable: true })
  resolutionType!: SyncIssueResolutionType | null;

  @ApiProperty({ nullable: true })
  resolutionNote!: string | null;

  @ApiProperty({ nullable: true })
  resolvedByUserId!: string | null;

  @ApiProperty()
  openedByRunId!: string;

  @ApiProperty()
  lastSeenByRunId!: string;

  @ApiProperty({ nullable: true })
  resolvedByRunId!: string | null;
}

export class SyncRunListItemDto implements SyncRunListItem {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  mode!: string;

  @ApiProperty({ enum: syncRunStatuses })
  status!: SyncRunStatus;

  @ApiProperty()
  startedAt!: string;

  @ApiProperty({ nullable: true })
  finishedAt!: string | null;

  @ApiProperty({ nullable: true })
  summary!: Record<string, unknown> | null;

  @ApiProperty()
  issueCount!: number;

  @ApiProperty({ type: SyncRunTriggerUserDto, nullable: true })
  triggeredByUser!: SyncRunTriggerUserDto | null;
}

export class SyncRunDetailDto extends SyncRunListItemDto implements SyncRunDetail {
  @ApiProperty({ type: SyncIssueItemDto, isArray: true })
  issues!: SyncIssueItemDto[];
}

export class SyncRunsPageDto implements PaginatedResponse<SyncRunListItemDto> {
  @ApiProperty({ type: SyncRunListItemDto, isArray: true })
  items!: SyncRunListItemDto[];

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  totalPages!: number;
}

export class SyncIssueStatesPageDto implements PaginatedResponse<SyncIssueStateItemDto> {
  @ApiProperty({ type: SyncIssueStateItemDto, isArray: true })
  items!: SyncIssueStateItemDto[];

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  totalPages!: number;
}

export class SyncOverviewDto implements SyncOverview {
  @ApiProperty({ type: SyncRunListItemDto, nullable: true })
  lastRun!: SyncRunListItemDto | null;

  @ApiProperty({ type: SyncRunListItemDto, nullable: true })
  lastSuccessfulRun!: SyncRunListItemDto | null;

  @ApiProperty({ type: SyncRunListItemDto, nullable: true })
  activeRun!: SyncRunListItemDto | null;

  @ApiProperty()
  openIssues!: number;
}

export class SyncEnqueueResponseDto {
  @ApiProperty()
  jobId!: string;

  @ApiProperty()
  status!: string;
}
