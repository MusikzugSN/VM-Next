import { drizzle } from 'drizzle-orm/mysql2';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { createPool, type Pool } from 'mysql2/promise';
import { join } from 'node:path';
import type { Database } from '../db/database';
import * as schema from '../db/schema';

/** Base URL of the test server; integration tests are skipped without it. */
export const TEST_DATABASE_URL = process.env['TEST_DATABASE_URL'];

if (!TEST_DATABASE_URL) {
  console.warn('TEST_DATABASE_URL is not set: every integration test in this file is skipped (see apps/api/README.md).');
}

export interface TestDatabase {
  db: Database;
  pool: Pool;
  close(): Promise<void>;
}

/**
 * Creates a fresh, migrated database `<base>_<suffix>` next to TEST_DATABASE_URL.
 * Each test file uses its own suffix, so files can run in parallel.
 */
export async function createTestDatabase(suffix: string): Promise<TestDatabase> {
  if (!TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL not set');
  const base = new URL(TEST_DATABASE_URL);
  const name = `${base.pathname.slice(1)}_${suffix}`.replace(/[^a-z0-9_]/gi, '_');

  const admin = createPool(TEST_DATABASE_URL);
  try {
    await admin.query(`drop database if exists \`${name}\``);
    await admin.query(`create database \`${name}\``);
  } finally {
    await admin.end();
  }

  const url = new URL(base);
  url.pathname = `/${name}`;
  const pool = createPool(url.toString());
  const db = drizzle({ client: pool, schema, mode: 'default' });
  await migrate(db, { migrationsFolder: join(__dirname, '../../drizzle') });
  return { db, pool, close: () => pool.end() };
}
