import type { ExecutionContext } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import { InternalSyncGuard } from './internal-sync.guard';

describe('InternalSyncGuard', () => {
  it('allows the request when the shared internal secret is valid', () => {
    const guard = new InternalSyncGuard();
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {
            'x-internal-sync-secret': process.env.INTERNAL_SYNC_SECRET,
          },
        }),
      }),
    } as ExecutionContext;

    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects the request when the shared internal secret is invalid', () => {
    const guard = new InternalSyncGuard();
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {
            'x-internal-sync-secret': 'invalid',
          },
        }),
      }),
    } as ExecutionContext;

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });
});
