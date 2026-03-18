import { AuditService } from './audit.service';

describe('AuditService', () => {
  it('persists requestId and metadata when recording events', async () => {
    const create = jest
      .fn<Promise<void>, [{ data: { requestId?: string | null } }]>()
      .mockResolvedValue(undefined);
    const service = new AuditService({
      auditEvent: {
        create,
      },
    } as never);

    await service.record({
      actorId: 'user-1',
      actorType: 'user',
      action: 'auth.login.success',
      resourceType: 'session',
      resourceId: 'session-1',
      requestId: 'req-1',
      metadata: {
        origin: 'spec',
      },
    });

    const firstCall = create.mock.calls[0]?.[0];
    expect(firstCall?.data.requestId).toBe('req-1');
  });
});
