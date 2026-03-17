import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  it('returns secure cookie defaults for access and refresh tokens', () => {
    const service = new AuthService(
      {} as never,
      new JwtService(),
      {
        getClient: () => ({
          del: jest.fn(),
          set: jest.fn(),
        }),
      } as never,
      {
        record: jest.fn(),
      } as never,
    );

    expect(service.getAccessCookieName()).toBe('fm_access_token');
    expect(service.getRefreshCookieName()).toBe('fm_refresh_token');
    expect(service.getAccessCookieConfig()).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    });
    expect(service.getRefreshCookieConfig()).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    });
  });
});
