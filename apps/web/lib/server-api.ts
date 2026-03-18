import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { resolveInternalApiBaseUrl } from './api-base-url';

export async function apiFetch(path: string, init?: RequestInit) {
  const cookieStore = cookies();
  const cookieHeader = (await cookieStore)
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join('; ');

  return fetch(`${resolveInternalApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      cookie: cookieHeader,
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });
}

export async function requireUser() {
  const response = await apiFetch('/v1/auth/me');

  if (!response.ok) {
    redirect('/login');
  }

  return response.json() as Promise<{
    id: string;
    name: string;
    email: string;
    roles: string[];
  }>;
}
