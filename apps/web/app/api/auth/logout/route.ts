import { NextRequest, NextResponse } from 'next/server';
import { resolveInternalApiBaseUrl } from '@/lib/api-base-url';
import { clearAuthCookies } from '@/lib/auth-cookie';

async function callBackendLogout(cookieHeader: string) {
  return fetch(`${resolveInternalApiBaseUrl()}/v1/auth/logout`, {
    method: 'POST',
    headers: {
      cookie: cookieHeader,
    },
  });
}

export async function POST(request: NextRequest) {
  const cookieHeader = request.headers.get('cookie') ?? '';

  await callBackendLogout(cookieHeader).catch(() => null);

  const response = NextResponse.json({
    message: 'Sessao encerrada.',
  });

  clearAuthCookies(response);

  return response;
}
