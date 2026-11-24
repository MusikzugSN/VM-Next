import { timestamp, index, mysqlTable, primaryKey, varchar } from 'drizzle-orm/mysql-core';
import { ensembles } from './ensembles';
import { roles } from './roles';
import { users } from './users';

/** A person in an ensemble with exactly one role there (R-1). */
export const memberships = mysqlTable(
  'memberships',
  {
    userId: varchar('user_id', { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ensembleId: varchar('ensemble_id', { length: 36 })
      .notNull()
      .references(() => ensembles.id, { onDelete: 'restrict' }),
    roleId: varchar('role_id', { length: 36 })
      .notNull()
      .references(() => roles.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { fsp: 6 }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.ensembleId] }),
    index('memberships_ensemble_idx').on(t.ensembleId),
    index('memberships_role_idx').on(t.roleId),
  ],
);
