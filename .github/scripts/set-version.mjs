// Sets "version" in the root package.json (single source of the release version: images,
// print service binary, GET /v1/status).   node .github/scripts/set-version.mjs 1.2.3
import { readFileSync, writeFileSync } from 'node:fs';

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) {
  console.error(`Usage: set-version.mjs X.Y.Z (got "${version}")`);
  process.exit(1);
}
const file = new URL('../../package.json', import.meta.url);
const pkg = JSON.parse(readFileSync(file, 'utf8'));
pkg.version = version;
writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`);
console.log(`package.json → ${version}`);
