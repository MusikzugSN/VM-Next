import { jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/** Bookkeeping for first-start imports, e.g. `seed.roles` → `{ version: 1 }` (R-5, N-8, S-5). */
export const systemState = pgTable('system_state', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
