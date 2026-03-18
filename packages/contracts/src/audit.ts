export type AuditActorType = 'user' | 'system';

export type AuditAction =
  | 'auth.login.success'
  | 'auth.login.failed'
  | 'auth.refresh'
  | 'auth.logout'
  | 'auth.password.changed'
  | 'auth.session.revoked'
  | 'iam.user.created'
  | 'iam.user.status.updated'
  | 'iam.user.roles.replaced'
  | 'read.company.list'
  | 'read.company.detail'
  | 'read.student.list'
  | 'read.student.detail'
  | 'sync.pedagogical.run'
  | 'sync.pedagogical.issue.resolved';

export interface AuditActorUser {
  id: string;
  name: string;
  email: string;
}

export interface AuditEventItem {
  id: string;
  actorType: AuditActorType;
  actorUser: AuditActorUser | null;
  action: AuditAction;
  resourceType: string;
  resourceId: string | null;
  ipAddress: string | null;
  requestId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface AuditEventPayload {
  actorId?: string | null;
  actorType: AuditActorType;
  action: AuditAction;
  resourceType: string;
  resourceId?: string | null;
  ipAddress?: string | null;
  metadata?: Record<string, unknown> | null;
}
