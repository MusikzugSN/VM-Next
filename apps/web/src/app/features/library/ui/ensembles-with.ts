import type { Permission } from '@vm-web/shared';

import type { SessionStore } from '../../../core/auth/session.store';

/** The ensembles of the session in which the person has the permission, e.g. for list filters. */
export function ensemblesWith(session: SessionStore, permission: Permission) {
  return (session.access()?.permissions.ensembles ?? []).filter((e) => session.can(permission, e.ensemble.id)).map((e) => e.ensemble);
}
