import { ApiPropertyOptional } from '@nestjs/swagger';
import type { SyncRunStatus } from '@financial-martec/contracts';
import { Transform } from 'class-transformer';
import { IsDateString, IsIn, IsOptional } from 'class-validator';
import { PageQueryDto } from '@/common/dto/page-query.dto';

const syncRunStatuses: SyncRunStatus[] = ['PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'PARTIAL'];

function trimString(value: unknown) {
  return typeof value === 'string' ? value.trim() : value;
}

export class QuerySyncRunsDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: syncRunStatuses })
  @IsOptional()
  @IsIn(syncRunStatuses)
  status?: SyncRunStatus;

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
