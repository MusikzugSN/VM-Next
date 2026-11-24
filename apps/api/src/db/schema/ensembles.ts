import { sql, type SQL } from 'drizzle-orm';
import { boolean, check, timestamp, foreignKey, mysqlTable, tinyint, uniqueIndex, varchar } from 'drizzle-orm/mysql-core';

/** Ensemble tree (F-3). Exactly one root, created on first start; roles apply to all descendants. */
export const ensembles = mysqlTable(
  'ensembles',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    parentId: varchar('parent_id', { length: 36 }),
    name: varchar('name', { length: 255 }).notNull(),
    isRoot: boolean('is_root').notNull().default(false),
    /**
     * MySQL has no partial/filtered unique index (unlike the Postgres `.where(isRoot)` index this
     * replaces). A generated column that is NULL unless isRoot is true gets the same effect: a
     * plain unique index on it enforces "at most one root", since MySQL (like Postgres) never
     * treats two NULLs as a duplicate in a unique index.
     */
    rootMarker: tinyint('root_marker').generatedAlwaysAs((): SQL => sql`if(${ensembles.isRoot}, 1, null)`, { mode: 'virtual' }),
    archivedAt: timestamp('archived_at', { fsp: 6 }),
    createdAt: timestamp('created_at', { fsp: 6 }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { fsp: 6 }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({ columns: [t.parentId], foreignColumns: [t.id], name: 'ensembles_parent_fk' }).onDelete('restrict'),
    check('ensembles_root_check', sql`${t.isRoot} = (${t.parentId} is null)`),
    uniqueIndex('ensembles_single_root_idx').on(t.rootMarker),
    uniqueIndex('ensembles_parent_name_idx').on(t.parentId, sql`lower(${t.name})`),
  ],
);
