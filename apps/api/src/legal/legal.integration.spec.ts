import { EMPTY_IMPRINT_DATA, EMPTY_PRIVACY_DATA } from '@vm-web/shared';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/mysql2';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { createPool } from 'mysql2/promise';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Database } from '../db/database';
import * as schema from '../db/schema';
import { FULL_IMPRINT, FULL_PRIVACY } from '../testing/legal-fixtures';
import { createTestDatabase, TEST_DATABASE_URL, type TestDatabase } from '../testing/test-database';
import { loadShippedTemplate } from './legal-templates';
import { DrizzleLegalStore } from './legal.store';

const MIGRATIONS = join(__dirname, '../../drizzle');

/** Legal settings against a real MySQL (TEST_DATABASE_URL), S-7. */
describe.skipIf(!TEST_DATABASE_URL)('Legal store and migration (TEST_DATABASE_URL)', () => {
  let testDb: TestDatabase;
  let store: DrizzleLegalStore;

  beforeAll(async () => {
    testDb = await createTestDatabase('legal');
    store = new DrizzleLegalStore(testDb.db);
  });
  afterAll(() => testDb.close());

  it('starts empty without rows', async () => {
    const state = await store.get();
    expect(state.documents.imprint).toMatchObject({ mode: null, url: null, acceptedTemplate: null });
    expect(state.imprintData).toEqual(EMPTY_IMPRINT_DATA);
    expect(state.privacyData).toEqual(EMPTY_PRIVACY_DATA);
  });

  it('stores settings, the accepted template and „Stand“', async () => {
    await store.saveSettings({
      documents: { imprint: { mode: 'generated', url: null }, privacy: { mode: 'link', url: 'https://mv.example/datenschutz' } },
      imprintData: FULL_IMPRINT,
      privacyData: FULL_PRIVACY,
    });
    const template = loadShippedTemplate('imprint');
    const at = new Date('2026-11-24T10:00:00Z');
    await store.accept('imprint', template, at);
    await store.setPublished('imprint', 'hash-1', '2026-11-24');

    const state = await store.get();
    expect(state.imprintData).toEqual(FULL_IMPRINT);
    expect(state.privacyData).toEqual(FULL_PRIVACY);
    expect(state.documents.privacy).toMatchObject({ mode: 'link', url: 'https://mv.example/datenschutz' });
    expect(state.documents.imprint).toEqual({ mode: 'generated', url: null, acceptedTemplate: template, acceptedAt: at, publishedHash: 'hash-1', asOf: '2026-11-24' });

    // saving again keeps the accepted template
    await store.saveSettings({
      documents: { imprint: { mode: 'generated', url: null }, privacy: { mode: null, url: null } },
      imprintData: FULL_IMPRINT,
      privacyData: FULL_PRIVACY,
    });
    expect((await store.get()).documents.imprint.acceptedTemplate?.version).toBe(template.version);
  });

  it('rejects unknown modes in the database', async () => {
    await expect(testDb.db.execute(sql`update legal_documents set mode = 'other' where document = 'imprint'`)).rejects.toThrow();
  });

  it('moves the links of S-4 into link mode (migration 0001_legal)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'vmweb-mig-'));
    const base = new URL(TEST_DATABASE_URL as string);
    const name = `${base.pathname.slice(1)}_legal_migration`;
    const admin = createPool(TEST_DATABASE_URL as string);
    await admin.query(`drop database if exists \`${name}\``);
    await admin.query(`create database \`${name}\``);
    await admin.end();
    const url = new URL(base);
    url.pathname = `/${name}`;
    const pool = createPool(url.toString());
    try {
      const db = drizzle({ client: pool, schema, mode: 'default' }) as unknown as Database;
      // all migrations before S-7
      await cp(MIGRATIONS, dir, { recursive: true });
      const journalFile = join(dir, 'meta/_journal.json');
      const journal = JSON.parse(await readFile(journalFile, 'utf8'));
      journal.entries = journal.entries.filter((e: { tag: string }) => e.tag < '0001_legal');
      await writeFile(journalFile, JSON.stringify(journal));
      await migrate(db, { migrationsFolder: dir });
      await pool.query(
        `insert into club_settings (id, club_name, imprint_url, privacy_url) values (1, 'MV', 'https://mv.example/impressum', null)`,
      );

      await migrate(db, { migrationsFolder: MIGRATIONS });
      const state = await new DrizzleLegalStore(db).get();
      expect(state.documents.imprint).toMatchObject({ mode: 'link', url: 'https://mv.example/impressum' });
      expect(state.documents.privacy).toMatchObject({ mode: null, url: null });
      const [columns] = await pool.query(
        `select column_name as name from information_schema.columns where table_schema = database() and table_name = 'club_settings'`,
      );
      expect((columns as { name: string }[]).map((r) => r.name)).not.toContain('imprint_url');
    } finally {
      await pool.end();
      await rm(dir, { recursive: true, force: true });
    }
  });
});
