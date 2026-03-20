import { NextResponse } from 'next/server';

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  ...(process.env.NODE_ENV === 'production' && process.env.COOKIE_DOMAIN
    ? { domain: process.env.COOKIE_DOMAIN }
    : {}),
};

export function appendBackendCookies(response: NextResponse, backendResponse: Response) {
  const getSetCookie = backendResponse.headers.getSetCookie?.bind(backendResponse.headers);
  const cookies = getSetCookie?.() ?? [];

  for (const cookie of cookies) {
    response.headers.append('set-cookie', cookie);
  }
}

export function clearAuthCookies(response: NextResponse) {
  const expiredAt = new Date(0);

  response.cookies.set({
    name: 'fm_access_token',
    value: '',
    ...COOKIE_OPTIONS,
    expires: expiredAt,
    maxAge: 0,
  });

  response.cookies.set({
    name: 'fm_refresh_token',
    value: '',
    ...COOKIE_OPTIONS,
    expires: expiredAt,
    maxAge: 0,
  });
}

