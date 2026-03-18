export const PEDAGOGICAL_SYNC_QUEUE = 'pedagogical-sync';

export const PEDAGOGICAL_SYNC_JOB = 'pedagogical.full-reconcile';
export const PEDAGOGICAL_SYNC_ENQUEUE_LOCK_KEY = 'pedagogical-sync:enqueue-lock';
export const PEDAGOGICAL_SYNC_ENQUEUE_LOCK_TTL_MS = 15_000;
export const PEDAGOGICAL_SYNC_LEASE_KEY = 'sync:pedagogical:lease';

export interface PedagogicalSyncJobPayload {
  triggeredByUserId: string | null;
  mode: 'manual' | 'schedule' | 'startup';
}

export const PEDAGOGICAL_SYNC_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 30_000,
  },
  removeOnComplete: 100,
  removeOnFail: 100,
};

export const PEDAGOGICAL_SYNC_IN_FLIGHT_JOB_STATES = [
  'active',
  'wait',
  'delayed',
  'prioritized',
] as const;
