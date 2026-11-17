import { z } from 'zod';

/** GET auth/login – starts the OIDC flow (A-1). Responds with 302 to the identity server. */
export const loginQuerySchema = z.object({
  /** Relative app path to return to after login; defaults to `/me` (A-3). Absolute URLs are rejected. */
  returnTo: z
    .string()
    .regex(/^\/(?!\/)/)
    .max(500)
    .optional(),
});
export type LoginQuery = z.infer<typeof loginQuerySchema>;

/** GET auth/callback – OIDC redirect target. Responds with 302 to `returnTo`, `/gesperrt` or `/login?error=…`. */
export const callbackQuerySchema = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
});
export type CallbackQuery = z.infer<typeof callbackQuerySchema>;

/** Error codes appended to `/login?error=` after a failed callback. */
export const loginErrorCodeSchema = z.enum(['login-failed', 'state-mismatch', 'idp-error']);
export type LoginErrorCode = z.infer<typeof loginErrorCodeSchema>;
