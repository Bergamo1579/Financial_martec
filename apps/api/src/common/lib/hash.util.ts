import { createHash } from 'crypto';

export function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export function stableJson(value: unknown) {
  return JSON.stringify(value, Object.keys(value as Record<string, unknown>).sort());
}
