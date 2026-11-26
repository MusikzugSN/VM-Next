import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

import { loginErrorCodeSchema, problemCodeSchema } from '@vm-web/shared';

import { AVAILABLE_LANGS, translationFile } from './i18n';

/** Workspace root: the first folder above the working directory with an nx.json. */
function workspaceRoot(): string {
  let dir = process.cwd();
  while (!existsSync(join(dir, 'nx.json'))) {
    const parent = dirname(dir);
    if (parent === dir) throw new Error('nx.json not found above ' + process.cwd());
    dir = parent;
  }
  return dir;
}

const WEB_ROOT = join(workspaceRoot(), 'apps/web');
const APP_ROOT = join(WEB_ROOT, 'src/app');
const TRANSLATE_ROOT = join(WEB_ROOT, 'public/translate');

type Json = { [key: string]: Json | string };

function readJson(file: string): Json {
  return JSON.parse(readFileSync(file, 'utf8')) as Json;
}

function has(tree: Json, key: string): boolean {
  let node: Json | string | undefined = tree;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return false;
    node = node[part];
  }
  // Plural keys (`tPlural`) are objects with `one` and `other`.
  if (typeof node === 'object' && node !== null) return typeof node['one'] === 'string' && typeof node['other'] === 'string';
  return typeof node === 'string';
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'shared' ? [] : sourceFiles(path);
    return /\.(ts|html)$/.test(name) && !name.endsWith('.spec.ts') ? [path] : [];
  });
}

/**
 * Keys used in the app: every quoted string that starts with a known namespace (a top-level key of
 * global.json or a scope name), e.g. `'me.folder.search'` or `emptyKey="me.folder.empty"`.
 * Dynamic keys (`errors.<code>`, `status.<kind>`) are covered by the code-based tests below.
 */
function usedKeys(namespaces: readonly string[]): { key: string; file: string }[] {
  const pattern = new RegExp(`['"]((?:${namespaces.join('|')})(?:\\.[\\w-]+)+)['"]`, 'g');
  const result: { key: string; file: string }[] = [];
  for (const file of sourceFiles(APP_ROOT)) {
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(pattern)) result.push({ key: match[1], file: relative(WEB_ROOT, file) });
  }
  return result;
}

describe('translationFile', () => {
  it('maps the global translation and scopes to /translate/<lang>/', () => {
    expect(translationFile('de-DE')).toBe('/translate/de-DE/global.json');
    expect(translationFile('me/de-DE')).toBe('/translate/de-DE/me.scope.json');
  });
});

describe.each(AVAILABLE_LANGS)('translations %s', (lang) => {
  const dir = join(TRANSLATE_ROOT, lang);
  const global = readJson(join(dir, 'global.json'));
  const scopes = new Map(
    readdirSync(dir)
      .filter((name) => name.endsWith('.scope.json'))
      .map((name) => [name.replace('.scope.json', ''), readJson(join(dir, name))] as const),
  );

  it('has a text for every problem code of the API', () => {
    for (const code of [...problemCodeSchema.options, 'network-error', 'unknown']) {
      expect(has(global, `errors.${code}`), `errors.${code}`).toBe(true);
    }
  });

  it('has a text for every login error', () => {
    for (const code of loginErrorCodeSchema.options) {
      expect(has(global, `errors.login.${code}`), `errors.login.${code}`).toBe(true);
    }
  });

  it('has every key used in templates and code', () => {
    const missing = usedKeys([...Object.keys(global), ...scopes.keys()]).filter(({ key }) => {
      const [first, ...rest] = key.split('.');
      // A scope may share its name with a global namespace (`print`, `legal`): Transloco merges them.
      const scope = scopes.get(first);
      return !(scope && has(scope, rest.join('.'))) && !has(global, key);
    });
    expect(missing).toEqual([]);
  });

  it('resolves every emptyKey of a list state', () => {
    const unresolved: { key: string; file: string }[] = [];
    for (const file of sourceFiles(APP_ROOT)) {
      for (const match of readFileSync(file, 'utf8').matchAll(/emptyKey="([\w.-]+)"/g)) {
        const [first, ...rest] = match[1].split('.');
        const scope = scopes.get(first);
        if (!(scope && has(scope, rest.join('.'))) && !has(global, match[1])) unresolved.push({ key: match[1], file: relative(WEB_ROOT, file) });
      }
    }
    expect(unresolved).toEqual([]);
  });
});
