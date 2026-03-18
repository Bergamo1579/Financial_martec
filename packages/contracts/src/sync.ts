export type SyncRunStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'PARTIAL';
export type SyncIssueSeverity = 'INFO' | 'WARNING' | 'ERROR';
export type SyncIssueStateStatus = 'open' | 'resolved';
export type SyncIssueResolutionType = 'AUTO_SYNC' | 'MANUAL';

export interface SyncRunTriggerUser {
  id: string;
  name: string;
  email: string;
}

export interface SyncIssueItem {
  id: string;
  entityType: string;
  entitySourceId: string | null;
  severity: SyncIssueSeverity;
  code: string;
  message: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface SyncIssueStateItem {
  id: string;
  fingerprint: string;
  entityType: string;
  entitySourceId: string | null;
  code: string;
  severity: SyncIssueSeverity;
  message: string;
  metadata: Record<string, unknown> | null;
  status: SyncIssueStateStatus;
  openedAt: string;
  lastSeenAt: string;
  resolvedAt: string | null;
  resolutionType: SyncIssueResolutionType | null;
  resolutionNote: string | null;
  resolvedByUserId: string | null;
  openedByRunId: string;
  lastSeenByRunId: string;
  resolvedByRunId: string | null;
}

export interface SyncRunListItem {
  id: string;
  mode: string;
  status: SyncRunStatus;
  startedAt: string;
  finishedAt: string | null;
  summary: Record<string, unknown> | null;
  issueCount: number;
  triggeredByUser: SyncRunTriggerUser | null;
}

export interface SyncRunDetail extends SyncRunListItem {
  issues: SyncIssueItem[];
}

export interface SyncOverview {
  lastRun: SyncRunListItem | null;
  lastSuccessfulRun: SyncRunListItem | null;
  activeRun: SyncRunListItem | null;
  openIssues: number;
}

export interface DashboardSummary {
  totalCompanies: number;
  totalStudents: number;
  lastSyncAt: string | null;
  lastSuccessfulSyncAt: string | null;
  lastSyncStatus: SyncRunStatus | null;
  openIssues: number;
}
