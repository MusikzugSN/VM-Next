import { z } from 'zod';
import { idSchema, refSchema } from '../common/ids.schema';

/**
 * Warning codes shown as banner in the configuration and role pages (B-1).
 * `default-role-has-club-permissions`: every new account gets club permissions (e.g. role `admin` ab Werk).
 */
export const configWarningSchema = z.enum(['default-role-has-club-permissions']);
export type ConfigWarning = z.infer<typeof configWarningSchema>;

/** GET system/config – configuration page (S-4, D-2, D-4). OIDC settings are environment-only and not included. */
export const configResponseSchema = z.object({
  club: z.object({
    clubName: z.string(),
    imprintUrl: z.url().nullable(),
    privacyUrl: z.url().nullable(),
    loginAutoRedirect: z.boolean(),
    logoUrl: z.string().nullable(),
    loginBanner: z.string().nullable(),
  }),
  defaults: z.object({
    defaultEnsemble: refSchema.nullable(),
    defaultRole: refSchema.nullable(),
  }),
  print: z.object({
    browserPrintPageLimit: z.number().int(),
    /** VM-Web address the print service accepts as origin (D-4). */
    publicBaseUrl: z.url().nullable(),
  }),
  warnings: z.array(configWarningSchema),
});
export type ConfigResponse = z.infer<typeof configResponseSchema>;

/** GET system/config/default-options – choices for the defaults tab. Not paginated. */
export const configDefaultOptionsResponseSchema = z.object({
  ensembles: z.array(refSchema),
  roles: z.array(refSchema.extend({ hasClubPermissions: z.boolean() })),
});
export type ConfigDefaultOptionsResponse = z.infer<typeof configDefaultOptionsResponseSchema>;

/** POST system/config/update-club → 204 (S-4, A-2). */
export const updateClubBodySchema = z.object({
  clubName: z.string().trim().min(1).max(100),
  imprintUrl: z.url().max(500).nullable(),
  privacyUrl: z.url().max(500).nullable(),
  /** Plain text banner on the login page (F-12). */
  loginBanner: z.string().trim().max(2000).nullable(),
  loginAutoRedirect: z.boolean(),
});
export type UpdateClubBody = z.infer<typeof updateClubBodySchema>;

/** POST system/config/update-defaults → 204 (A-3). */
export const updateDefaultsBodySchema = z.object({
  defaultEnsembleId: idSchema.nullable(),
  defaultRoleId: idSchema.nullable(),
});
export type UpdateDefaultsBody = z.infer<typeof updateDefaultsBodySchema>;

/** POST system/config/update-print → 204 (D-2, D-4). */
export const updatePrintBodySchema = z.object({
  browserPrintPageLimit: z.number().int().min(1).max(500),
  publicBaseUrl: z.url().max(500).nullable(),
});
export type UpdatePrintBody = z.infer<typeof updatePrintBodySchema>;

/**
 * POST system/config/upload-logo – `multipart/form-data` with field `file`
 * (PNG, JPEG, SVG, WebP; max 2 MB, see `LOGO_*`) → 204. POST system/config/remove-logo → 204.
 */
