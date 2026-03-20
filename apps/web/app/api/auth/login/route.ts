import { NextRequest, NextResponse } from 'next/server';
import { resolveInternalApiBaseUrl } from '@/lib/api-base-url';
import { appendBackendCookies } from '@/lib/auth-cookie';

export async function POST(request: NextRequest) {
  const body = (await request.json()) as unknown;
  let apiResponse: Response;

  try {
    apiResponse = await fetch(`${resolveInternalApiBaseUrl()}/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return NextResponse.json(
      {
        message: 'Servico de autenticacao indisponivel. Verifique se o backend esta online.',
      },
      { status: 503 },
    );
  }

  const data = (await apiResponse.json().catch(() => null)) as unknown;
  const response = NextResponse.json(data, { status: apiResponse.status });

  // Forward Set-Cookie headers from the backend so they are scoped to the
  // web origin (localhost:3000) instead of the API origin (localhost:4000).
  // This ensures the Next.js middleware can read them on every subsequent request.
  appendBackendCookies(response, apiResponse);

  return response;
}
