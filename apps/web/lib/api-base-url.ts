function trimTrailingSlash(value: string) {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

export function resolveInternalApiBaseUrl() {
  return trimTrailingSlash(
    process.env.INTERNAL_API_BASE_URL ??
      process.env.NEXT_PUBLIC_API_BASE_URL ??
      'http://localhost:4000',
  );
}

export function resolvePublicApiBaseUrl() {
  return trimTrailingSlash(
    process.env.NEXT_PUBLIC_API_BASE_URL ??
      process.env.INTERNAL_API_BASE_URL ??
      'http://localhost:4000',
  );
}
