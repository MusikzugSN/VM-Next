/**
 * All frontend paths, shared by the web app (Angular routing, links) and the API (redirects after login).
 *
 * - Links: `appPath(APP_ROUTES.me.folder, { folderId })` → `/me/folders/<id>`.
 * - Angular routing: `childSegment(APP_ROUTES.me.folder, APP_ROUTES.me.root)` → `folders/:folderId`.
 * - API: `appPath(APP_ROUTES.login, {}, { error: 'login-failed' })`.
 *
 * Path parameters use the `:name` syntax, like Angular and Express. Tabs within a page are query
 * parameters (`APP_QUERY.tab`), so links stay stable and the back button works.
 */
export const APP_ROUTES = {
  login: '/login',
  blocked: '/blocked',
  /** Third-party packages with version and license; public. */
  dependencies: '/dependencies',
  forbidden: '/forbidden',
  /** Public legal pages (S-7); German paths because they are linked publicly. */
  imprint: '/impressum',
  privacy: '/datenschutz',

  me: {
    root: '/me',
    folders: '/me/folders',
    folder: '/me/folders/:folderId',
    events: '/me/events',
    event: '/me/events/:eventId',
    tags: '/me/tags',
    clubTag: '/me/tags/club/:tagId',
    personalTag: '/me/tags/personal/:tagId',
    score: '/me/scores/:scoreId',
    uploads: '/me/uploads',
    profile: '/me/profile',
  },

  library: {
    root: '/library',
    scores: '/library/scores',
    newScore: '/library/scores/new',
    importScores: '/library/scores/import',
    score: '/library/scores/:scoreId',
    review: '/library/review',
    reviewUpload: '/library/review/:uploadId',
    folders: '/library/folders',
    folder: '/library/folders/:folderId',
    events: '/library/events',
    event: '/library/events/:eventId',
    tags: '/library/tags',
    voices: '/library/voices',
  },

  print: {
    root: '/print',
  },

  system: {
    root: '/system',
    users: '/system/users',
    user: '/system/users/:userId',
    ensembles: '/system/ensembles',
    ensemble: '/system/ensembles/:ensembleId',
    roles: '/system/roles',
    role: '/system/roles/:roleId',
    settings: '/system/settings',
  },
} as const;

/** Start page after login when no `returnTo` is given (A-3). */
export const DEFAULT_APP_PATH = APP_ROUTES.me.root;

/** Query parameter names used across pages. */
export const APP_QUERY = {
  /** `/login?returnTo=/me/folders/…` – where to go after login. */
  returnTo: 'returnTo',
  /** `/login?error=login-failed` – see `loginErrorCodeSchema`. */
  error: 'error',
  /** Active tab of a page, e.g. `/me/events?tab=archive`. */
  tab: 'tab',
} as const;

type Leaves<T> = T extends string ? T : { [K in keyof T]: Leaves<T[K]> }[keyof T];
/** Every frontend path template, e.g. `'/me/folders/:folderId'`. */
export type AppPath = Leaves<typeof APP_ROUTES>;

/** Path parameters of a template: `PathParams<'/a/:x/b/:y'>` = `{ x: string; y: string }`. */
export type PathParams<P extends string> = P extends `${string}:${infer Name}/${infer Rest}`
  ? { [K in Name | keyof PathParams<`/${Rest}`>]: string }
  : P extends `${string}:${infer Name}`
    ? { [K in Name]: string }
    : Record<string, never>;

type QueryValue = string | number | boolean | null | undefined;

/**
 * Builds a concrete path from a template: fills `:params` (URL-encoded) and appends the query string.
 * Query entries that are `null`, `undefined` or `''` are left out.
 */
export function appPath<P extends AppPath>(
  template: P,
  params: PathParams<P> = {} as PathParams<P>,
  query: Record<string, QueryValue> = {},
): string {
  const values = params as Record<string, string>;
  const path = template.replace(/:([A-Za-z]+)/g, (_, name: string) => {
    const value = values[name];
    if (value === undefined) throw new Error(`Missing path parameter "${name}" for ${template}`);
    return encodeURIComponent(value);
  });
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined || value === '') continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `${path}?${qs}` : path;
}

/**
 * The part of a path below its parent, for nested Angular routes:
 * `childSegment('/me/folders/:folderId', '/me')` → `'folders/:folderId'`; the parent itself → `''`.
 */
export function childSegment(path: AppPath, parent: AppPath | '/'): string {
  if (parent === '/') return path.slice(1);
  if (path === parent) return '';
  if (!path.startsWith(`${parent}/`)) throw new Error(`${path} is not below ${parent}`);
  return path.slice(parent.length + 1);
}
