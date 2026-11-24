import { int, mysqlTable } from 'drizzle-orm/mysql-core';

/**
 * Single fixed row, inserted by the migration (not by application code), so it is guaranteed to
 * exist before the very first seed runs. `SELECT ... FOR UPDATE` on it serializes concurrent
 * first starts (S-5) the same way `clubSettings.id = 1` serializes the first-login race, which
 * can't use that row itself: the seed is what creates it.
 */
export const seedLock = mysqlTable('seed_lock', {
  id: int('id').primaryKey(),
});
