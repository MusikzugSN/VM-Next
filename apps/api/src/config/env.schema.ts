import { z } from 'zod';

const booleanString = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');

const positiveInt = z.coerce.number().int().positive();

/**
 * Environment of the API, validated once at startup. Keep `.env.example` in sync.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: positiveInt.default(3000),
  /** Behind the club's reverse proxy: trust `X-Forwarded-*` (secure cookies, client IP). */
  TRUST_PROXY: booleanString.default(false),
  LOG_LEVEL: z.enum(['error', 'warn', 'log', 'debug', 'verbose']).default('log'),
  /** Time zone of the club: decides when an event counts as past (M-5). */
  APP_TIMEZONE: z
    .string()
    .default('Europe/Berlin')
    .refine((tz) => {
      try {
        new Intl.DateTimeFormat('en', { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, 'unknown IANA time zone'),

  /** Browser-facing address of VM-Web, e.g. `https://noten.example.org` (redirects, cookies). */
  PUBLIC_BASE_URL: z.url(),

  DATABASE_URL: z.string().regex(/^mysql:\/\//, 'must be a mysql:// URL'),
  /** Run pending Drizzle migrations when the API starts. */
  DB_MIGRATE_ON_START: booleanString.default(true),

  /** Directory of the file storage volume (PDFs, logo). */
  FILE_STORAGE_PATH: z.string().min(1),
  UPLOAD_MAX_FILE_MB: positiveInt.default(50),

  OIDC_ISSUER_URL: z.url(),
  OIDC_CLIENT_ID: z.string().min(1),
  /** Optional: public clients use PKCE only. */
  OIDC_CLIENT_SECRET: z.string().min(1).optional(),
  OIDC_SCOPES: z.string().default('openid profile email'),

  SESSION_IDLE_TTL_DAYS: positiveInt.default(14),
  SESSION_ABSOLUTE_TTL_DAYS: positiveInt.default(90),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validates `process.env`; throws one readable error listing every problem.
 * Empty values (`KEY=` in .env files) count as unset, so defaults and optional fields apply.
 */
export function validateEnv(raw: Record<string, unknown>): Env {
  const withoutEmpty = Object.fromEntries(Object.entries(raw).filter(([, value]) => value !== ''));
  const result = envSchema.safeParse(withoutEmpty);
  if (result.success) return result.data;
  const lines = result.error.issues.map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`);
  throw new Error(`Invalid environment configuration:\n${lines.join('\n')}`);
}
