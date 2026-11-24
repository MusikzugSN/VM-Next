import { ALL_PERMISSIONS } from '@vm-web/shared';
import { sql } from 'drizzle-orm';
import { check, timestamp, mysqlTable, primaryKey, uniqueIndex, varchar } from 'drizzle-orm/mysql-core';

/** Named bundles of permissions (R-3, R-5). `defaultKey` links to `defaults/roles.default.json`. */
export const roles = mysqlTable(
  'roles',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    defaultKey: varchar('default_key', { length: 255 }).unique(),
    name: varchar('name', { length: 255 }).notNull(),
    createdAt: timestamp('created_at', { fsp: 6 }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { fsp: 6 }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('roles_name_idx').on(sql`lower(${t.name})`)],
);

const knownPermissions = sql.raw(ALL_PERMISSIONS.map((p) => `'${p}'`).join(', '));

/** Permissions of a role; the check constraint follows the codes in `@vm-web/shared` (new codes → new migration). */
export const rolePermissions = mysqlTable(
  'role_permissions',
  {
    roleId: varchar('role_id', { length: 36 })
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permission: varchar('permission', { length: 255 }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.roleId, t.permission] }),
    check('role_permissions_known_check', sql`${t.permission} in (${knownPermissions})`),
  ],
);
