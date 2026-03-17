import type { Request } from 'express';

export function getRequestIp(request: Request) {
  const forwarded = request.headers['x-forwarded-for'];

  if (Array.isArray(forwarded)) {
    return forwarded[0] ?? request.ip;
  }

  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0]?.trim() ?? request.ip;
  }

  return request.ip;
}
