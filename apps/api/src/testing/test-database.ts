import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { join } from 'node:path';
import { Pool } from 'pg';
import type { Database } from '../db/database';
import * as schema from '../db/schema';

/** Base URL of the test server; integration tests are skipped without it. */
export const TEST_DATABASE_URL = process.env['TEST_DATABASE_URL'];

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

  const admin = new Pool({ connectionString: TEST_DATABASE_URL, max: 1 });
  try {
    await admin.query(`drop database if exists "${name}" with (force)`);
    await admin.query(`create database "${name}"`);
  } finally {
    await admin.end();
  }

  const url = new URL(base);
  url.pathname = `/${name}`;
  const pool = new Pool({ connectionString: url.toString(), max: 5 });
  const db = drizzle({ client: pool, schema });
  await migrate(db, { migrationsFolder: join(__dirname, '../../drizzle') });
  return { db, pool, close: () => pool.end() };
}
