export type AuditActorType = 'user' | 'system';

export type AuditAction = string;

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
