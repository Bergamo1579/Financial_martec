import { createHash } from 'crypto';

export function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function normalizeForStableJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeForStableJson(entry));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entryValue]) => [key, normalizeForStableJson(entryValue)]),
    );
  }

  return value;
}

export function stableJson(value: unknown) {
  return JSON.stringify(normalizeForStableJson(value));
}
