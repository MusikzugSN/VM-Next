import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Directory of the shipped defaults (`roles.default.json`, `lineup.default.json`):
 * next to `main.js` in the build (webpack copies `apps/api/defaults`), `apps/api/defaults` from source.
 */
export function defaultsDir(): string {
  const candidates = [join(__dirname, 'defaults'), join(__dirname, '../../defaults')];
  const found = candidates.find((dir) => existsSync(join(dir, 'roles.default.json')));
  if (!found) throw new Error(`Shipped defaults not found in ${candidates.join(' or ')}`);
  return found;
}

export const rolesFile = () => join(defaultsDir(), 'roles.default.json');
export const lineupTemplateFile = () => join(defaultsDir(), 'lineup.default.json');
