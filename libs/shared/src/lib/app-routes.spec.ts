import { APP_ROUTES, AppPath, appPath, childSegment, DEFAULT_APP_PATH } from './app-routes';

function allPaths(node: unknown): string[] {
  if (typeof node === 'string') return [node];
  return Object.values(node as Record<string, unknown>).flatMap(allPaths);
}

describe('APP_ROUTES', () => {
  const paths = allPaths(APP_ROUTES);

  it('contains only unique, absolute, lower-case English paths', () => {
    expect(new Set(paths).size).toBe(paths.length);
    for (const path of paths) expect(path).toMatch(/^(\/[a-z-]+|\/:[A-Za-z]+)+$/);
  });

  it('keeps every page of an area below its root', () => {
    for (const area of ['me', 'library', 'print', 'system'] as const) {
      const { root, ...pages } = APP_ROUTES[area] as Record<string, string>;
      for (const page of Object.values(pages)) expect(page.startsWith(`${root}/`)).toBe(true);
    }
  });

  it('starts at Mein Bereich', () => {
    expect(DEFAULT_APP_PATH).toBe('/me');
  });
});

describe('appPath', () => {
  it('fills and encodes path parameters', () => {
    expect(appPath(APP_ROUTES.me.folder, { folderId: 'a b/c' })).toBe('/me/folders/a%20b%2Fc');
    expect(appPath(APP_ROUTES.me.clubTag, { tagId: 't1' })).toBe('/me/tags/club/t1');
  });

  it('appends the query and drops empty values', () => {
    expect(appPath(APP_ROUTES.login, {}, { error: 'login-failed', returnTo: undefined, tab: '' })).toBe(
      '/login?error=login-failed',
    );
    expect(appPath(APP_ROUTES.me.events, {}, { tab: 'archive' })).toBe('/me/events?tab=archive');
  });

  it('throws on a missing parameter', () => {
    expect(() => appPath(APP_ROUTES.system.user, {} as { userId: string })).toThrow(/userId/);
  });
});

describe('childSegment', () => {
  it('returns the part below the parent', () => {
    expect(childSegment(APP_ROUTES.me.folder, APP_ROUTES.me.root)).toBe('folders/:folderId');
    expect(childSegment(APP_ROUTES.me.root, APP_ROUTES.me.root)).toBe('');
    expect(childSegment(APP_ROUTES.library.root, '/')).toBe('library');
  });

  it('rejects paths outside the parent', () => {
    expect(() => childSegment(APP_ROUTES.system.users, APP_ROUTES.me.root as AppPath)).toThrow();
  });
});
