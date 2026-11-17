import * as z from 'zod';

/** CRUD actions per area (R-3). „Öffnen“ und „Auflisten“ sind in `view` zusammengefasst. */
export const PERMISSION_ACTIONS = ['view', 'create', 'edit', 'delete'] as const;
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

/**
 * How a permission is evaluated (R-4). Ensembles form a tree; a role held in an ensemble
 * also applies to all its descendants (rights complement each other, F-3).
 * - `ensemble`: must be held in the element's ensemble or one of its ancestors (folders, events, members).
 * - `any-ensemble`: element has no ensemble; held in at least one ensemble is enough (scores, voices, club tags, review, upload).
 * - `club`: system permission; held in any membership it applies club-wide (F-1).
 */
export const permissionScopeSchema = z.enum(['ensemble', 'any-ensemble', 'club']);
export type PermissionScope = z.infer<typeof permissionScopeSchema>;

/** Areas with the four CRUD actions, as rows of the permission matrix (R-7). */
export const PERMISSION_AREAS = {
  score: 'any-ensemble',
  voice: 'any-ensemble',
  tag: 'any-ensemble',
  folder: 'ensemble',
  event: 'ensemble',
  user: 'club',
  role: 'club',
  ensemble: 'club',
} as const satisfies Record<string, PermissionScope>;
export type PermissionArea = keyof typeof PERMISSION_AREAS;

/** Single permissions outside the CRUD scheme (R-3). */
export const SINGLE_PERMISSIONS = {
  /** „Noten hochladen“ (F-2): upload dialog, missing-voice upload (M-9, N-11). */
  'sheet.upload': 'any-ensemble',
  /** „Noten freigeben“: review uploads, own uploads are approved immediately (N-10). */
  'sheet.approve': 'any-ensemble',
  /** „Mitglieder sehen“ in one ensemble. */
  'member.view': 'ensemble',
  'config.view': 'club',
  'config.edit': 'club',
} as const satisfies Record<string, PermissionScope>;

type AreaPermission = `${PermissionArea}.${PermissionAction}`;
export type Permission = AreaPermission | keyof typeof SINGLE_PERMISSIONS;

export const ALL_PERMISSIONS: readonly Permission[] = [
  ...(Object.keys(PERMISSION_AREAS) as PermissionArea[]).flatMap((area) =>
    PERMISSION_ACTIONS.map((action) => `${area}.${action}` as const),
  ),
  ...(Object.keys(SINGLE_PERMISSIONS) as (keyof typeof SINGLE_PERMISSIONS)[]),
];

export const permissionSchema = z.enum(ALL_PERMISSIONS as [Permission, ...Permission[]]);

export function permissionScope(permission: Permission): PermissionScope {
  const single = (SINGLE_PERMISSIONS as Record<string, PermissionScope>)[permission];
  if (single) return single;
  const area = permission.split('.')[0] as PermissionArea;
  return PERMISSION_AREAS[area];
}
