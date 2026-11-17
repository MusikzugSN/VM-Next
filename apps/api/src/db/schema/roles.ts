import { ALL_PERMISSIONS } from '@vm-web/shared';
import { sql } from 'drizzle-orm';
import { check, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

/** Named bundles of permissions (R-3, R-5). `defaultKey` links to `defaults/roles.default.json`. */
export const roles = pgTable(
  'roles',
  {
    id: uuid('id').primaryKey(),
    defaultKey: text('default_key').unique(),
    name: text('name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('roles_name_idx').on(sql`lower(${t.name})`)],
);

const knownPermissions = sql.raw(ALL_PERMISSIONS.map((p) => `'${p}'`).join(', '));

/** Permissions of a role; the check constraint follows the codes in `@vm-web/shared` (new codes → new migration). */
export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permission: text('permission').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.roleId, t.permission] }),
    check('role_permissions_known_check', sql`${t.permission} in (${knownPermissions})`),
  ],
);
