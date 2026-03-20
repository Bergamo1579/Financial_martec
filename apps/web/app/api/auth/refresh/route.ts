import { NextRequest, NextResponse } from 'next/server';
import { resolveInternalApiBaseUrl } from '@/lib/api-base-url';
import { appendBackendCookies, clearAuthCookies } from '@/lib/auth-cookie';

function getNextPath(request: NextRequest) {
  const nextPath = request.nextUrl.searchParams.get('next');
  return nextPath && nextPath.startsWith('/') ? nextPath : '/login';
}

function isFetchMode(request: NextRequest) {
  return request.nextUrl.searchParams.get('mode') === 'fetch';
}

export async function GET(request: NextRequest) {
  const cookieHeader = request.headers.get('cookie') ?? '';
  const nextPath = getNextPath(request);
  const fetchMode = isFetchMode(request);
  let apiResponse: Response;

  try {
    apiResponse = await fetch(`${resolveInternalApiBaseUrl()}/v1/auth/refresh`, {
      method: 'POST',
      headers: {
        cookie: cookieHeader,
      },
    });
  } catch {
    if (fetchMode) {
      const response = NextResponse.json(
        {
          message: 'Servico de autenticacao indisponivel.',
        },
        { status: 503 },
      );
      clearAuthCookies(response);
      return response;
    }

    const response = NextResponse.redirect(new URL('/login', request.url));
    clearAuthCookies(response);
    return response;
  }

  if (!apiResponse.ok) {
    if (fetchMode) {
      const response = NextResponse.json(
        {
          message: 'Sessao expirada.',
        },
        { status: 401 },
      );
      clearAuthCookies(response);
      return response;
    }

    const response = NextResponse.redirect(new URL('/login', request.url));
    clearAuthCookies(response);
    return response;
  }

  if (fetchMode) {
    const response = NextResponse.json({
      status: 'refreshed',
    });
    appendBackendCookies(response, apiResponse);
    return response;
  }

  const response = NextResponse.redirect(new URL(nextPath, request.url));
  appendBackendCookies(response, apiResponse);
  return response;
}
