import { ALL_PERMISSIONS, PERMISSION_ACTIONS, PERMISSION_AREAS, type Permission } from '@vm-web/shared';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';

/** Format of `defaults/roles.default.json` (R-5). Permissions: exact codes, `area.*` or `*`. */
export const defaultRolesFileSchema = z.object({
  version: z.number().int().positive(),
  roles: z
    .array(
      z.object({
        key: z.string().regex(/^[a-z][a-z0-9-]*$/),
        name: z.string().trim().min(1).max(100),
        permissions: z.array(z.string()),
      }),
    )
    .min(1),
});

export interface DefaultRole {
  key: string;
  name: string;
  permissions: Permission[];
}

/** Expands `*` and `area.*`; unknown codes are an error in the shipped file. */
export function expandPermissions(patterns: readonly string[]): Permission[] {
  const result = new Set<Permission>();
  for (const pattern of patterns) {
    if (pattern === '*') {
      ALL_PERMISSIONS.forEach((p) => result.add(p));
    } else if (pattern.endsWith('.*')) {
      const area = pattern.slice(0, -2);
      if (!(area in PERMISSION_AREAS)) throw new Error(`Unknown permission area "${area}"`);
      PERMISSION_ACTIONS.forEach((a) => result.add(`${area}.${a}` as Permission));
    } else if ((ALL_PERMISSIONS as readonly string[]).includes(pattern)) {
      result.add(pattern as Permission);
    } else {
      throw new Error(`Unknown permission "${pattern}"`);
    }
  }
  return ALL_PERMISSIONS.filter((p) => result.has(p));
}

export function parseDefaultRoles(json: unknown): { version: number; roles: DefaultRole[] } {
  const file = defaultRolesFileSchema.parse(json);
  const keys = new Set<string>();
  const roles = file.roles.map((r) => {
    if (keys.has(r.key)) throw new Error(`Duplicate role key "${r.key}"`);
    keys.add(r.key);
    return { key: r.key, name: r.name, permissions: expandPermissions(r.permissions) };
  });
  if (!keys.has('admin')) throw new Error('roles.default.json must contain the role "admin" (F-3)');
  return { version: file.version, roles };
}

export async function loadDefaultRoles(path: string): Promise<{ version: number; roles: DefaultRole[] }> {
  return parseDefaultRoles(JSON.parse(await readFile(path, 'utf8')));
}
