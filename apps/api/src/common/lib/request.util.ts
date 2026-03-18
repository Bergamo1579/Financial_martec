import type { Request } from 'express';

export function getRequestIp(request: Request) {
  return request.ip ?? request.socket.remoteAddress ?? null;
}

export function getRequestId(request: Request & { id?: unknown }) {
  return request.id !== undefined && request.id !== null ? String(request.id) : null;
}
