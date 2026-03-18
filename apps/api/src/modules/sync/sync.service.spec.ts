import { PEDAGOGICAL_SYNC_JOB_OPTIONS } from '@financial-martec/contracts';
const addMock = jest.fn();
const getJobCountsMock = jest.fn();
const redisGetMock = jest.fn();
const redisSetMock = jest.fn();
const redisEvalMock = jest.fn();

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: addMock,
    getJobCounts: getJobCountsMock,
  })),
}));

import { SyncService } from './sync.service';

describe('SyncService', () => {
  beforeEach(() => {
    addMock.mockReset();
    getJobCountsMock.mockReset();
    redisGetMock.mockReset();
    redisSetMock.mockReset();
    redisEvalMock.mockReset();
    redisGetMock.mockResolvedValue(null);
    redisSetMock.mockResolvedValue('OK');
    redisEvalMock.mockResolvedValue(1);
    getJobCountsMock.mockResolvedValue({
      active: 0,
      wait: 0,
      delayed: 0,
      prioritized: 0,
    });
  });

  it('audits the manual enqueue and returns queue metadata', async () => {
    addMock.mockResolvedValue({ id: 'job-1' });
    const auditRecord = jest.fn().mockResolvedValue(undefined);
    const service = new SyncService(
      {
        getClient: () => ({
          get: redisGetMock,
          set: redisSetMock,
          eval: redisEvalMock,
        }),
      } as never,
      {
        pedagogicalSyncRun: {
          count: jest.fn().mockResolvedValue(0),
        },
      } as never,
      {
        recoverStaleRuns: jest.fn().mockResolvedValue(0),
      } as never,
      {
        record: auditRecord,
      } as never,
    );

    const result = await service.enqueuePedagogicalSync('user-1', 'req-1');

    expect(result).toEqual({
      jobId: 'job-1',
      status: 'queued',
    });
    expect(auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'sync.pedagogical.run',
        requestId: 'req-1',
      }),
    );
    expect(addMock).toHaveBeenCalledWith(
      'pedagogical.full-reconcile',
      {
        triggeredByUserId: 'user-1',
        mode: 'manual',
      },
      PEDAGOGICAL_SYNC_JOB_OPTIONS,
    );
    expect(redisSetMock).toHaveBeenCalled();
    expect(redisEvalMock).toHaveBeenCalled();
  });

  it('rejects concurrent enqueue attempts when the enqueue lock is already held', async () => {
    redisSetMock.mockResolvedValue(null);
    const service = new SyncService(
      {
        getClient: () => ({
          get: redisGetMock,
          set: redisSetMock,
          eval: redisEvalMock,
        }),
      } as never,
      {
        pedagogicalSyncRun: {
          count: jest.fn().mockResolvedValue(0),
        },
      } as never,
      {
        recoverStaleRuns: jest.fn().mockResolvedValue(0),
      } as never,
      {
        record: jest.fn(),
      } as never,
    );

    await expect(service.enqueuePedagogicalSync('user-1')).rejects.toThrow(
      'Ja existe uma requisicao de sync sendo processada.',
    );
    expect(addMock).not.toHaveBeenCalled();
  });
});
