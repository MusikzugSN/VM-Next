// Writes the list of third-party runtime packages (transitive, web and API) with version, license and
// link for the „Abhängigkeiten“ page. Source: `pnpm licenses list --prod`, i.e. the installed packages.
// Usage: node apps/web/scripts/generate-dependencies.mjs <output file>
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const out = resolve(process.argv[2] ?? 'dist/generated/web/dependencies.json');

const raw = execSync('pnpm licenses list --prod --json', { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
/** @type {Record<string, { name: string; versions: string[]; homepage?: string }[]>} */
const byLicense = JSON.parse(raw);

const packages = [];
for (const [license, entries] of Object.entries(byLicense)) {
  for (const entry of entries) {
    for (const version of entry.versions) {
      packages.push({ name: entry.name, version, license, url: linkFor(entry.name, version, entry.homepage) });
    }
  }
}
packages.sort((a, b) => a.name.localeCompare(b.name, 'en') || a.version.localeCompare(b.version, 'en', { numeric: true }));

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({ packages }) + '\n');
console.log(`${packages.length} packages → ${out}`);

/** Project homepage when it is a web address, otherwise the package's npm page. */
function linkFor(name, version, homepage) {
  if (typeof homepage === 'string' && /^https?:\/\//.test(homepage)) return homepage;
  return `https://www.npmjs.com/package/${name}/v/${version}`;
}
