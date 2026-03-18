import { resolveInternalApiBaseUrl } from '@/lib/api-base-url';

export const dynamic = 'force-dynamic';

const OPENAPI_CANDIDATES = [
  '/reference-json',
  '/reference/openapi.json',
  '/openapi.json',
] as const;

export async function GET() {
  const baseUrl = resolveInternalApiBaseUrl();

  for (const candidate of OPENAPI_CANDIDATES) {
    let response: Response;
    try {
      response = await fetch(`${baseUrl}${candidate}`, {
        cache: 'no-store',
      });
    } catch {
      continue;
    }

    if (!response.ok) {
      continue;
    }

    const body = await response.text();

    return new Response(body, {
      status: 200,
      headers: {
        'content-type': response.headers.get('content-type') ?? 'application/json; charset=utf-8',
      },
    });
  }

  return Response.json(
    {
      code: 'openapi_unavailable',
      message: 'Nao foi possivel localizar o schema OpenAPI da API.',
    },
    {
      status: 502,
    },
  );
}
