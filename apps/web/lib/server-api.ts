import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type {
  AuthBootstrapResponse,
  AuthUserResponse,
  NavigationResponse,
} from '@financial-martec/contracts';
import { resolveInternalApiBaseUrl } from './api-base-url';

async function getCookieHeader() {
  const cookieStore = await cookies();

  return cookieStore
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join('; ');
}

function isNetworkLikeError(error: unknown) {
  return error instanceof TypeError || (error instanceof Error && error.message.includes('fetch failed'));
}

export async function apiFetch(path: string, init?: RequestInit) {
  const cookieHeader = await getCookieHeader();

  try {
    return await fetch(`${resolveInternalApiBaseUrl()}${path}`, {
      ...init,
      headers: {
        cookie: cookieHeader,
        ...(init?.headers ?? {}),
      },
      cache: 'no-store',
    });
  } catch (error) {
    if (isNetworkLikeError(error)) {
      throw new Error('BACKEND_UNAVAILABLE');
    }

    throw error;
  }
}

export async function apiFetchJson<T>(path: string, init?: RequestInit) {
  let response: Response;

  try {
    response = await apiFetch(path, init);
  } catch (error) {
    if (error instanceof Error && error.message === 'BACKEND_UNAVAILABLE') {
      redirect('/login');
    }

    throw error;
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;

    if (response.status === 401 || response.status === 403) {
      redirect('/login');
    }

    throw new Error(payload?.message ?? `API request failed for ${path}`);
  }

  return response.json() as Promise<T>;
}

const getAuthBootstrap = cache(async (): Promise<AuthBootstrapResponse | null> => {
  let response: Response;

  try {
    response = await apiFetch('/v1/auth/bootstrap');
  } catch (error) {
    if (error instanceof Error && error.message === 'BACKEND_UNAVAILABLE') {
      return null;
    }

    throw error;
  }

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? 'Falha ao carregar a sessao autenticada.');
  }

  return response.json() as Promise<AuthBootstrapResponse>;
});

export async function getOptionalUser() {
  const bootstrap = await getAuthBootstrap();
  return bootstrap?.user ?? null;
}

export async function requireBootstrap() {
  const bootstrap = await getAuthBootstrap();
  if (!bootstrap) {
    redirect('/login');
  }

  return bootstrap;
}

export async function requireUser() {
  const bootstrap = await requireBootstrap();
  return bootstrap.user;
}

export async function requireNavigation() {
  const bootstrap = await requireBootstrap();
  return bootstrap.navigation;
}

export async function requireArea(area: 'BACKOFFICE' | 'APP') {
  const bootstrap = await requireBootstrap();
  const { user } = bootstrap;

  if (user.mustChangePassword) {
    redirect('/change-password');
  }

  if (!user.areas.includes(area)) {
    redirect('/forbidden');
  }

  return bootstrap;
}

export async function requireScreen(path: string, area: 'BACKOFFICE' | 'APP') {
  const bootstrap = await requireArea(area);
  const allowed = bootstrap.navigation.items.some((item) => item.path === path);
  if (!allowed) {
    redirect('/forbidden');
  }

  return bootstrap satisfies {
    user: AuthUserResponse;
    navigation: NavigationResponse;
  };
}
