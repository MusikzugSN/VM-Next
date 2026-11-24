import * as z from 'zod';
import { idSchema, shortNameSchema } from '../common/ids.schema';
import { PERMISSION_ACTIONS, permissionSchema, permissionScopeSchema } from '../common/permissions.schema';
import { pageSchema, cursorQuerySchema } from '../common/pagination.schema';

/**
 * GET system/role-list (S-3, R-5). Roles have no scope of their own: a role is always assigned
 * per ensemble membership; club permissions in it apply club-wide (F-1).
 */
export const roleListQuerySchema = cursorQuerySchema;
export const roleListItemSchema = z.object({
  id: idSchema,
  /** Key from `defaults/roles.default.json` (`admin` is created on first start), `null` for own roles. */
  defaultKey: z.string().nullable(),
  name: z.string(),
  /** Contains at least one club permission → UI shows a warning banner (B-1). */
  hasClubPermissions: z.boolean(),
  /** Default role whose permissions differ from the shipped file. */
  modifiedFromDefault: z.boolean(),
  assignmentCount: z.number().int(),
});
export type RoleListItem = z.infer<typeof roleListItemSchema>;
export const roleListResponseSchema = pageSchema(roleListItemSchema);
export type RoleListResponse = z.infer<typeof roleListResponseSchema>;

/**
 * GET system/permission-catalog – structure of the matrix (R-3, R-7): areas as rows, actions as columns,
 * plus single permissions. `scope` tells the UI how a permission is evaluated. Codes only; labels come from i18n.
 */
export const permissionCatalogResponseSchema = z.object({
  actions: z.array(z.enum(PERMISSION_ACTIONS)),
  areas: z.array(z.object({ area: z.string(), scope: permissionScopeSchema, permissions: z.array(permissionSchema) })),
  singles: z.array(z.object({ permission: permissionSchema, scope: permissionScopeSchema })),
});
export type PermissionCatalogResponse = z.infer<typeof permissionCatalogResponseSchema>;

/** GET system/roles/:roleId/details (S-3). */
export const roleDetailsResponseSchema = roleListItemSchema.extend({
  permissions: z.array(permissionSchema),
});
export type RoleDetailsResponse = z.infer<typeof roleDetailsResponseSchema>;

/** POST system/roles/create → 201 `{ id }`. */
export const createRoleBodySchema = z.object({
  name: shortNameSchema,
  permissions: z.array(permissionSchema).default([]),
});
export type CreateRoleBody = z.infer<typeof createRoleBodySchema>;

/** POST system/roles/:roleId/set-permissions → 204 (R-7). Rename: `renameBodySchema`. */
export const setPermissionsBodySchema = z.object({ permissions: z.array(permissionSchema) });
export type SetPermissionsBody = z.infer<typeof setPermissionsBodySchema>;

/** POST system/roles/reset-defaults → 200 (R-5): resets every default role, re-creates deleted ones. */
export const resetDefaultsResponseSchema = z.object({
  reset: z.number().int(),
  recreated: z.number().int(),
});
export type ResetDefaultsResponse = z.infer<typeof resetDefaultsResponseSchema>;
