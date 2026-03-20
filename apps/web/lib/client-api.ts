'use client';

import { resolvePublicApiBaseUrl } from './api-base-url';

type ClientFetchOptions = {
  retryOnUnauthorized?: boolean;
};

let refreshPromise: Promise<boolean> | null = null;

function buildHeaders(init?: RequestInit) {
  return {
    'content-type': 'application/json',
    ...(init?.headers ?? {}),
  };
}

async function refreshBrowserSession() {
  if (refreshPromise) {
    return refreshPromise;
  }

  const nextPath =
    typeof window === 'undefined' ? '/login' : `${window.location.pathname}${window.location.search}`;

  refreshPromise = (async () => {
    const response = await fetch(
      `/api/auth/refresh?mode=fetch&next=${encodeURIComponent(nextPath)}`,
      {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      },
    );

    return response.ok;
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

export async function apiClientFetch(
  path: string,
  init?: RequestInit,
  options: ClientFetchOptions = {},
) {
  let response: Response;

  try {
    response = await fetch(`${resolvePublicApiBaseUrl()}${path}`, {
      ...init,
      credentials: 'include',
      headers: buildHeaders(init),
      cache: 'no-store',
    });
  } catch {
    throw new Error('Nao foi possivel conectar ao backend.');
  }

  if (response.status === 401 && options.retryOnUnauthorized !== false) {
    const refreshed = await refreshBrowserSession();
    if (refreshed) {
      return apiClientFetch(path, init, { retryOnUnauthorized: false });
    }

    if (typeof window !== 'undefined') {
      window.location.replace('/login');
    }

    throw new Error('Sessao expirada. Faca login novamente.');
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? 'Falha ao processar a requisicao.');
  }

  return response;
}
