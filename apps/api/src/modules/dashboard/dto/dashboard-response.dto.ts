import { ApiProperty } from '@nestjs/swagger';
import type { DashboardSummary, SyncRunStatus } from '@financial-martec/contracts';

const syncStatuses: SyncRunStatus[] = ['PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'PARTIAL'];

export class DashboardSummaryDto implements DashboardSummary {
  @ApiProperty()
  totalCompanies!: number;

  @ApiProperty()
  totalStudents!: number;

  @ApiProperty({ nullable: true })
  lastSyncAt!: string | null;

  @ApiProperty({ nullable: true })
  lastSuccessfulSyncAt!: string | null;

  @ApiProperty({ enum: syncStatuses, nullable: true })
  lastSyncStatus!: SyncRunStatus | null;

  @ApiProperty()
  openIssues!: number;
}
