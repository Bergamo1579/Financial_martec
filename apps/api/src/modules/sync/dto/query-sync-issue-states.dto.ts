import { ApiPropertyOptional } from '@nestjs/swagger';
import type {
  SyncIssueResolutionType,
  SyncIssueStateStatus,
} from '@financial-martec/contracts';
import { Transform } from 'class-transformer';
import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';
import { PageQueryDto } from '@/common/dto/page-query.dto';

const syncIssueStateStatuses: SyncIssueStateStatus[] = ['open', 'resolved'];
const syncIssueResolutionTypes: SyncIssueResolutionType[] = ['AUTO_SYNC', 'MANUAL'];

function trimString(value: unknown) {
  return typeof value === 'string' ? value.trim() : value;
}

export class QuerySyncIssueStatesDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: syncIssueStateStatuses })
  @IsOptional()
  @IsIn(syncIssueStateStatuses)
  status?: SyncIssueStateStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  entityType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  code?: string;

  @ApiPropertyOptional({ enum: syncIssueResolutionTypes })
  @IsOptional()
  @IsIn(syncIssueResolutionTypes)
  resolutionType?: SyncIssueResolutionType;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsDateString()
  to?: string;
}
