import { sql } from 'drizzle-orm';

import { cacheEntries } from '../db/schema';
import { createTestDatabase, TEST_DATABASE_URL, type TestDatabase } from '../testing/test-database';
import { PostgresCacheService } from './postgres-cache.service';

/** Runs against a real PostgreSQL when TEST_DATABASE_URL is set (see apps/api/README.md). */
describe.skipIf(!TEST_DATABASE_URL)('PostgresCacheService (TEST_DATABASE_URL)', () => {
  let testDb: TestDatabase;
  let cache: PostgresCacheService;

  beforeAll(async () => {
    testDb = await createTestDatabase('cache');
    cache = new PostgresCacheService(testDb.db);
  });

  afterAll(async () => {
    cache?.onModuleDestroy();
    await testDb?.close();
  });

  it('stores, overwrites and deletes plain values', async () => {
    await cache.set('session:a', { userId: 'u1', createdAt: 1 }, 60);
    expect(await cache.get('session:a')).toEqual({ userId: 'u1', createdAt: 1 });

    await cache.set('session:a', { userId: 'u2', createdAt: 2 }, 60);
    expect(await cache.get('session:a')).toEqual({ userId: 'u2', createdAt: 2 });

    await cache.delete('session:a');
    expect(await cache.get('session:a')).toBeUndefined();
  });

  it('does not return expired entries and sweeps them', async () => {
    await cache.set('login:old', { nonce: 'x' }, 60);
    await testDb.db.update(cacheEntries).set({ expiresAt: sql`now() - interval '1 second'` });
    expect(await cache.get('login:old')).toBeUndefined();
    expect(await cache.sweep()).toBeGreaterThanOrEqual(1);
  });

  it('refuses a non-positive lifetime', async () => {
    await expect(cache.set('x', 1, 0)).rejects.toThrow(RangeError);
  });
});
