import * as z from 'zod';
import { idSchema, refSchema } from '../common/ids.schema';
import { permissionSchema } from '../common/permissions.schema';

export const sessionUserSchema = z.object({
  id: idSchema,
  name: z.string(),
  email: z.string().nullable(),
  pictureUrl: z.url().nullable(),
  isAdmin: z.boolean(),
});
export type SessionUser = z.infer<typeof sessionUserSchema>;

/** Effective permissions of the current user; used by the frontend only to show/hide navigation. */
export const sessionPermissionsSchema = z.object({
  /** Club permissions from any role in any membership (F-1). */
  club: z.array(permissionSchema),
  /** Permissions held in at least one ensemble (relevant for `any-ensemble` scope). */
  anyEnsemble: z.array(permissionSchema),
  /** Direct memberships (R-1). */
  memberships: z.array(z.object({ ensemble: refSchema, role: refSchema })),
  /** Effective permissions per ensemble incl. those inherited from ancestors (F-3). */
  ensembles: z.array(z.object({ ensemble: refSchema, permissions: z.array(permissionSchema) })),
});
export type SessionPermissions = z.infer<typeof sessionPermissionsSchema>;

/** GET auth/session */
export const sessionResponseSchema = z.discriminatedUnion('authenticated', [
  z.object({ authenticated: z.literal(false) }),
  z.object({
    authenticated: z.literal(true),
    user: sessionUserSchema,
    permissions: sessionPermissionsSchema,
  }),
]);
export type SessionResponse = z.infer<typeof sessionResponseSchema>;

/** CSRF: double-submit token bound to the session; cookie `XSRF-TOKEN`, header `X-XSRF-TOKEN` (Angular default). */
export const CSRF_COOKIE = 'XSRF-TOKEN';
export const CSRF_HEADER = 'X-XSRF-TOKEN';
export const SESSION_COOKIE = 'vmweb_session';
