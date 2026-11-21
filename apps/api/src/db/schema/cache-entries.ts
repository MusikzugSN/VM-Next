import { index, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Key-value store with expiry behind `ICacheService`: server-side sessions and short-lived login
 * state (A-1). Keys are hashes (`session:<sha256>`), never raw session ids. Survives API restarts
 * and works with several API instances.
 */
export const cacheEntries = pgTable(
  'cache_entries',
  {
    key: text('key').primaryKey(),
    value: jsonb('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => [index('cache_entries_expires_idx').on(t.expiresAt)],
);
