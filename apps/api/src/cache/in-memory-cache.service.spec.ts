import { InMemoryCacheService } from './in-memory-cache.service';

describe('InMemoryCacheService', () => {
  let cache: InMemoryCacheService;

  beforeEach(() => {
    vi.useFakeTimers();
    cache = new InMemoryCacheService();
  });

  afterEach(() => {
    cache.onModuleDestroy();
    vi.useRealTimers();
  });

  it('returns stored values until the TTL expires', async () => {
    await cache.set('session:a', { userId: 'u-1' }, 10);
    vi.advanceTimersByTime(9_999);
    expect(await cache.get('session:a')).toEqual({ userId: 'u-1' });
    vi.advanceTimersByTime(1);
    expect(await cache.get('session:a')).toBeUndefined();
  });

  it('overwrites and deletes', async () => {
    await cache.set('k', 1, 60);
    await cache.set('k', 2, 60);
    expect(await cache.get('k')).toBe(2);
    await cache.delete('k');
    await cache.delete('k');
    expect(await cache.get('k')).toBeUndefined();
  });

  it('clones values so callers cannot mutate stored state', async () => {
    const value = { roles: ['a'] };
    await cache.set('k', value, 60);
    value.roles.push('b');
    const read = await cache.get<{ roles: string[] }>('k');
    read?.roles.push('c');
    expect(await cache.get('k')).toEqual({ roles: ['a'] });
  });

  it('sweeps expired entries periodically', async () => {
    await cache.set('short', 1, 1);
    await cache.set('long', 1, 3600);
    vi.advanceTimersByTime(60_000);
    expect((cache as unknown as { entries: Map<string, unknown> }).entries.size).toBe(1);
  });

  it('rejects non-positive TTLs', async () => {
    await expect(cache.set('k', 1, 0)).rejects.toThrow(RangeError);
  });
});
