import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isJwtExpired } from '@/lib/jwt';

const PUBLIC_PATHS = ['/login', '/docs'];

export function middleware(request: NextRequest) {
  const accessToken = request.cookies.get('fm_access_token')?.value;
  const refreshToken = request.cookies.get('fm_refresh_token')?.value;
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some((path) => pathname.startsWith(path));
  const isProtected =
    pathname === '/' ||
    pathname === '/change-password' ||
    pathname === '/forbidden' ||
    pathname.startsWith('/backoffice') ||
    pathname.startsWith('/app') ||
    pathname.startsWith('/empresas') ||
    pathname.startsWith('/alunos');

  const shouldRefresh =
    Boolean(refreshToken) &&
    (pathname.startsWith('/login') || isProtected) &&
    (!accessToken || isJwtExpired(accessToken));

  if (shouldRefresh) {
    const refreshUrl = request.nextUrl.clone();
    refreshUrl.pathname = '/api/auth/refresh';
    refreshUrl.search = '';
    refreshUrl.searchParams.set('next', `${pathname}${request.nextUrl.search}`);

    return NextResponse.redirect(refreshUrl);
  }

  if (!accessToken && isProtected && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
