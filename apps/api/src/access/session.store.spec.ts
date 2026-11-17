import { InMemoryCacheService } from '../cache/in-memory-cache.service';
import type { AppConfig } from '../config/app-config.service';
import { fakeConfig } from '../testing/access-fixtures';
import { parseCookies } from './cookies';
import { tokensMatch } from './session.guard';
import { SessionStore } from './session.store';

const DAY = 86_400_000;

describe('SessionStore', () => {
  let cache: InMemoryCacheService;
  let store: SessionStore;

  beforeEach(() => {
    vi.useFakeTimers();
    cache = new InMemoryCacheService();
    store = new SessionStore(cache, fakeConfig({ SESSION_IDLE_TTL_DAYS: 14, SESSION_ABSOLUTE_TTL_DAYS: 90 }) as unknown as AppConfig);
  });
  afterEach(() => {
    cache.onModuleDestroy();
    vi.useRealTimers();
  });

  it('creates random ids and CSRF tokens and does not store the raw id', async () => {
    const a = await store.create('u-1', null);
    const b = await store.create('u-1', null);
    expect(a.id).not.toBe(b.id);
    expect(a.id).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a.data.csrfToken).not.toBe(b.data.csrfToken);
    expect(await cache.get(`session:${a.id}`)).toBeUndefined();
    expect(await store.get(a.id)).toMatchObject({ userId: 'u-1' });
  });

  it('expires after the idle time and slides with activity (F-14)', async () => {
    const { id } = await store.create('u-1', null);
    vi.advanceTimersByTime(13 * DAY);
    expect(await store.get(id)).toBeDefined(); // touch
    vi.advanceTimersByTime(13 * DAY);
    expect(await store.get(id)).toBeDefined();
    vi.advanceTimersByTime(14 * DAY + 1);
    expect(await store.get(id)).toBeUndefined();
  });

  it('ends after the absolute lifetime even with activity', async () => {
    const { id } = await store.create('u-1', null);
    for (let day = 0; day < 89; day += 7) {
      vi.advanceTimersByTime(7 * DAY);
      if (day + 7 < 90) expect(await store.get(id)).toBeDefined();
    }
    vi.advanceTimersByTime(7 * DAY);
    expect(await store.get(id)).toBeUndefined();
  });

  it('destroys sessions', async () => {
    const { id } = await store.create('u-1', null);
    await store.destroy(id);
    expect(await store.get(id)).toBeUndefined();
  });

  it('hands out a login state only once', async () => {
    await store.saveLoginState('s', { codeVerifier: 'v', nonce: 'n', returnTo: '/me' });
    expect(await store.takeLoginState('s')).toEqual({ codeVerifier: 'v', nonce: 'n', returnTo: '/me' });
    expect(await store.takeLoginState('s')).toBeUndefined();
  });
});

describe('cookie helpers', () => {
  it('parses cookie headers', () => {
    expect(parseCookies('a=1; b="x%20y"; a=2; broken; c=%E0')).toEqual({ a: '1', b: 'x y', c: '%E0' });
    expect(parseCookies(undefined)).toEqual({});
  });

  it('compares tokens in constant time and rejects missing ones', () => {
    expect(tokensMatch('abc', 'abc')).toBe(true);
    expect(tokensMatch('abc', 'abd')).toBe(false);
    expect(tokensMatch('abc', 'ab')).toBe(false);
    expect(tokensMatch('abc', undefined)).toBe(false);
  });
});
