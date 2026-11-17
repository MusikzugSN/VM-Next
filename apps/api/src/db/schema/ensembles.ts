import { sql } from 'drizzle-orm';
import { boolean, check, foreignKey, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

/** Ensemble tree (F-3). Exactly one root, created on first start; roles apply to all descendants. */
export const ensembles = pgTable(
  'ensembles',
  {
    id: uuid('id').primaryKey(),
    parentId: uuid('parent_id'),
    name: text('name').notNull(),
    isRoot: boolean('is_root').notNull().default(false),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({ columns: [t.parentId], foreignColumns: [t.id], name: 'ensembles_parent_fk' }).onDelete('restrict'),
    check('ensembles_root_check', sql`${t.isRoot} = (${t.parentId} is null)`),
    uniqueIndex('ensembles_single_root_idx').on(t.isRoot).where(sql`${t.isRoot}`),
    uniqueIndex('ensembles_parent_name_idx').on(t.parentId, sql`lower(${t.name})`),
  ],
);
