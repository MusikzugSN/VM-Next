// On release branches: the database migrations must be the first N migrations of master, unchanged
// and in the same order. Otherwise an installation could not update from a bugfix release to the
// next minor release (Drizzle applies migrations by position in apps/api/drizzle/meta/_journal.json).
//
//   node .github/scripts/check-migrations.mjs [base-ref, default origin/master]
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const base = process.argv[2] ?? 'origin/master';
const dir = 'apps/api/drizzle';
const show = (ref, path) => execFileSync('git', ['show', `${ref}:${path}`], { encoding: 'utf8' });
const entries = (json) => JSON.parse(json).entries.map((e) => e.tag);

const here = entries(readFileSync(`${dir}/meta/_journal.json`, 'utf8'));
const master = entries(show(base, `${dir}/meta/_journal.json`));
const problems = [];

here.forEach((tag, i) => {
  if (master[i] !== tag) {
    problems.push(`#${i} is "${tag}" here but "${master[i] ?? '(missing)'}" on ${base}`);
    return;
  }
  const sql = readFileSync(`${dir}/${tag}.sql`, 'utf8').replace(/\r\n/g, '\n');
  if (sql !== show(base, `${dir}/${tag}.sql`).replace(/\r\n/g, '\n')) {
    problems.push(`${tag}.sql differs from ${base}`);
  }
});

if (problems.length) {
  console.error(`::error::Migrations on this branch are not a prefix of ${base}:`);
  for (const p of problems) console.error(`  - ${p}`);
  console.error('Land the migration on master first, then backport it unchanged (docs/release.md).');
  process.exit(1);
}
console.log(`OK: ${here.length} migrations, all identical to the first ${here.length} on ${base}.`);
