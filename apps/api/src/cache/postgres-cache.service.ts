import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { and, eq, gt, lte, sql } from 'drizzle-orm';

import { DATABASE, type Database } from '../db/database';
import { cacheEntries } from '../db/schema';
import type { ICacheService } from './cache.service';

/** Expired rows are filtered on read anyway; the sweep only keeps the table small. */
const SWEEP_INTERVAL_MS = 10 * 60_000;

/**
 * `ICacheService` on Postgres (table `cache_entries`): sessions survive restarts and are shared
 * between API instances. Values are stored as JSONB, so they must be plain data (as the interface
 * already requires).
 */
@Injectable()
export class PostgresCacheService implements ICacheService, OnModuleDestroy {
  private readonly logger = new Logger(PostgresCacheService.name);
  private readonly sweeper = setInterval(() => void this.sweep(), SWEEP_INTERVAL_MS);

  constructor(@Inject(DATABASE) private readonly db: Database) {
    this.sweeper.unref();
  }

  async get<T>(key: string): Promise<T | undefined> {
    const [row] = await this.db
      .select({ value: cacheEntries.value })
      .from(cacheEntries)
      .where(and(eq(cacheEntries.key, key), gt(cacheEntries.expiresAt, sql`now()`)));
    return row ? (row.value as T) : undefined;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    if (!(ttlSeconds > 0)) throw new RangeError(`ttlSeconds must be positive, got ${ttlSeconds}`);
    const expiresAt = sql`now() + make_interval(secs => ${ttlSeconds})`;
    await this.db
      .insert(cacheEntries)
      .values({ key, value: value as unknown, expiresAt })
      .onConflictDoUpdate({ target: cacheEntries.key, set: { value: value as unknown, expiresAt } });
  }

  async delete(key: string): Promise<void> {
    await this.db.delete(cacheEntries).where(eq(cacheEntries.key, key));
  }

  /** Removes expired entries; returns how many. */
  async sweep(): Promise<number> {
    try {
      const removed = await this.db.delete(cacheEntries).where(lte(cacheEntries.expiresAt, sql`now()`)).returning({ key: cacheEntries.key });
      return removed.length;
    } catch (error) {
      this.logger.warn(`Sweeping expired cache entries failed: ${String(error)}`);
      return 0;
    }
  }

  onModuleDestroy(): void {
    clearInterval(this.sweeper);
  }
}
