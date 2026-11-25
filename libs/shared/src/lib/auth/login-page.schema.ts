import * as z from 'zod';
import { legalLinkSchema } from '../legal/legal.schema';

/** GET auth/login-page – public branding for the login page (A-2, S-4). */
export const loginPageResponseSchema = z.object({
  clubName: z.string(),
  /** Relative URL of `auth/branding/logo`, `null` if none uploaded. */
  logoUrl: z.string().nullable(),
  /** Banner text written by an admin (F-12); plain text, line breaks allowed. */
  loginBanner: z.string().nullable(),
  /** Imprint and privacy policy: external URL (mode link) or `/impressum`, `/datenschutz` (S-7). */
  imprint: legalLinkSchema,
  privacy: legalLinkSchema,
  /** Redirect to the identity server immediately (A-2). */
  autoRedirect: z.boolean(),
});
export type LoginPageResponse = z.infer<typeof loginPageResponseSchema>;

export const LOGO_FILE_FIELD = 'file';
export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const LOGO_MIME_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'] as const;
