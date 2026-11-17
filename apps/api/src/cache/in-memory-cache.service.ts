import { Injectable, OnModuleDestroy } from '@nestjs/common';
import type { ICacheService } from './cache.service';

interface Entry {
  value: unknown;
  expiresAt: number;
}

const SWEEP_INTERVAL_MS = 60_000;

/**
 * Process-local cache. Values are cloned on write and read, so callers cannot mutate
 * stored state – the same behaviour a serializing store would have.
 * Not shared between instances: run a single API instance while this is in use.
 */
@Injectable()
export class InMemoryCacheService implements ICacheService, OnModuleDestroy {
  private readonly entries = new Map<string, Entry>();
  private readonly sweeper = setInterval(() => this.sweep(), SWEEP_INTERVAL_MS);

  constructor() {
    this.sweeper.unref();
  }

  async get<T>(key: string): Promise<T | undefined> {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return structuredClone(entry.value) as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    if (!(ttlSeconds > 0)) throw new RangeError(`ttlSeconds must be positive, got ${ttlSeconds}`);
    this.entries.set(key, { value: structuredClone(value), expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async delete(key: string): Promise<void> {
    this.entries.delete(key);
  }

  /** Removes expired entries; also called periodically. */
  sweep(): void {
    const now = Date.now();
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(key);
    }
  }

  onModuleDestroy(): void {
    clearInterval(this.sweeper);
  }
}
