import { timestamp, json, mysqlTable, varchar } from 'drizzle-orm/mysql-core';

/** Bookkeeping for first-start imports, e.g. `seed.roles` → `{ version: 1 }` (R-5, N-8, S-5). */
export const systemState = mysqlTable('system_state', {
  key: varchar('key', { length: 255 }).primaryKey(),
  value: json('value').notNull(),
  updatedAt: timestamp('updated_at', { fsp: 6 }).notNull().defaultNow(),
});
