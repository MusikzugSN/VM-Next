import { timestamp, index, json, mysqlTable, varchar } from 'drizzle-orm/mysql-core';

/**
 * Key-value store with expiry behind `ICacheService`: server-side sessions and short-lived login
 * state (A-1). Keys are hashes (`session:<sha256>`), never raw session ids. Survives API restarts
 * and works with several API instances.
 */
export const cacheEntries = mysqlTable(
  'cache_entries',
  {
    key: varchar('key', { length: 255 }).primaryKey(),
    value: json('value').notNull(),
    expiresAt: timestamp('expires_at', { fsp: 6 }).notNull(),
  },
  (t) => [index('cache_entries_expires_idx').on(t.expiresAt)],
);
