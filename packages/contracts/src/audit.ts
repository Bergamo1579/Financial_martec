export type AuditActorType = 'user' | 'system';

export type AuditAction =
  | 'auth.login.success'
  | 'auth.login.failed'
  | 'auth.refresh'
  | 'auth.logout'
  | 'read.company.list'
  | 'read.company.detail'
  | 'read.student.list'
  | 'read.student.detail'
  | 'sync.pedagogical.run';

export interface AuditEventPayload {
  actorId?: string | null;
  actorType: AuditActorType;
  action: AuditAction;
  resourceType: string;
  resourceId?: string | null;
  ipAddress?: string | null;
  metadata?: Record<string, unknown> | null;
}
