import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_PORT: z.coerce.number().default(4000),
  APP_URL: z.string().url().default('http://localhost:4000'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  TRUST_PROXY: z.string().optional(),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  COOKIE_DOMAIN: z.string().optional(),
  ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(7),
  LOGIN_MAX_ATTEMPTS: z.coerce.number().default(5),
  LOGIN_LOCK_MINUTES: z.coerce.number().default(15),
  ADMIN_BOOTSTRAP_EMAIL: z.string().email().optional(),
  ADMIN_BOOTSTRAP_PASSWORD: z.string().optional(),
  ADMIN_BOOTSTRAP_NAME: z.string().optional(),
  PEDAGOGICAL_API_BASE_URL: z.string().url(),
  PEDAGOGICAL_API_KEY: z.string().optional(),
  PEDAGOGICAL_USERNAME: z.string().optional(),
  PEDAGOGICAL_PASSWORD: z.string().optional(),
  PEDAGOGICAL_PAGINATION_MODE: z.enum(['auto', 'off', 'force']).default('auto'),
  PEDAGOGICAL_PAGE_SIZE: z.coerce.number().int().positive().max(5_000).default(500),
  PEDAGOGICAL_REQUEST_TIMEOUT_MS: z.coerce.number().default(30_000),
  INTERNAL_SYNC_SECRET: z.string().min(16),
});

export const env = envSchema.parse(process.env);

export const isProduction = env.NODE_ENV === 'production';

export const authCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: isProduction,
  path: '/',
  ...(isProduction && env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
};
