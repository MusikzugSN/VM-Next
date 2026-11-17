/**
 * Key-value cache with TTL, used for sessions and short-lived login state.
 * Inject with `@Inject(CACHE_SERVICE)`. Values must be structured-cloneable (plain data)
 * so that a Redis or Postgres implementation can serialize them later.
 */
export interface ICacheService {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
}

export const CACHE_SERVICE = Symbol('ICacheService');
