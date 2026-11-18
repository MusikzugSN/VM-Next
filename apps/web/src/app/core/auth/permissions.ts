import { permissionScope, type Permission, type SessionPermissions } from '@vm-web/shared';

export interface Access {
  readonly isAdmin: boolean;
  readonly permissions: SessionPermissions;
}

/**
 * Same rules as the API's `AccessContext` (R-4, F-1, F-3), on the effective permissions from
 * `GET auth/session`. The frontend uses this only to show or hide things; the API decides.
 *
 * - Admin: everything.
 * - `club`: held in any membership.
 * - `any-ensemble`: held in at least one ensemble.
 * - `ensemble`: held in that ensemble (inherited ones are already included by the API);
 *   without an ensemble id: held in at least one ensemble (e.g. for navigation).
 */
export function hasPermission(access: Access, permission: Permission, ensembleId?: string): boolean {
  if (access.isAdmin) return true;
  const { club, anyEnsemble, ensembles } = access.permissions;
  switch (permissionScope(permission)) {
    case 'club':
      return club.includes(permission);
    case 'any-ensemble':
      return anyEnsemble.includes(permission);
    case 'ensemble':
      if (ensembleId === undefined) return anyEnsemble.includes(permission);
      return ensembles.some((entry) => entry.ensemble.id === ensembleId && entry.permissions.includes(permission));
  }
}

/** Mein Bereich, Drucken and uploads of the own area need a membership in at least one ensemble (R-2). */
export function isMember(access: Access): boolean {
  return access.isAdmin || access.permissions.memberships.length > 0;
}
