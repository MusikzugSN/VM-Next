import { index, pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core';
import { ensembles } from './ensembles';
import { roles } from './roles';
import { users } from './users';

/** A person in an ensemble with exactly one role there (R-1). */
export const memberships = pgTable(
  'memberships',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ensembleId: uuid('ensemble_id')
      .notNull()
      .references(() => ensembles.id, { onDelete: 'restrict' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.ensembleId] }),
    index('memberships_ensemble_idx').on(t.ensembleId),
    index('memberships_role_idx').on(t.roleId),
  ],
);
