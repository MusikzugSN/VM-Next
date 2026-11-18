import type { Permission } from '@vm-web/shared';

/**
 * i18n key of a permission: `score.edit` → `system.permissions.codes.score_edit`
 * (dots would be read as nesting by Transloco).
 */
export function permissionKey(permission: Permission): string {
  return `system.permissions.codes.${permission.replace('.', '_')}`;
}

/**
 * Toggles one permission and keeps the matrix consistent (R-3): create, edit and delete
 * need view in the same area; removing view removes the other actions of the area.
 * Single permissions (`sheet.upload`, …) and `config.edit` → `config.view` follow the same rule.
 */
export function withDependencies(current: ReadonlySet<Permission>, permission: Permission, on: boolean): ReadonlySet<Permission> {
  const next = new Set(current);
  const [area, action] = permission.split('.');
  const view = `${area}.view` as Permission;
  if (on) {
    next.add(permission);
    if (action !== 'view' && isKnown(view)) next.add(view);
  } else {
    next.delete(permission);
    if (action === 'view') {
      for (const p of current) if (p.startsWith(`${area}.`)) next.delete(p);
    }
  }
  return next;
}

const VIEW_PERMISSIONS = new Set(['score', 'voice', 'tag', 'folder', 'event', 'user', 'role', 'ensemble', 'config'].map((a) => `${a}.view`));

function isKnown(permission: string): boolean {
  return VIEW_PERMISSIONS.has(permission);
}
