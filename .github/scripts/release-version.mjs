// Works out the next release from the git tags (vX.Y.Z) and writes it to $GITHUB_OUTPUT.
//
//   node .github/scripts/release-version.mjs start <minor|major> [explicit X.Y.0]
//     new release line from master: version X.Y.0, branch release/X.Y (must not exist yet)
//   node .github/scripts/release-version.mjs patch <release/X.Y>
//     bugfix on a release branch: next free X.Y.Z, needs commits since the last tag
//
// Outputs: version, tag, branch, minor (X.Y), latest (true when this is the highest version).
// See docs/release.md.
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const fail = (message) => {
  console.error(`::error::${message}`);
  process.exit(1);
};

const parse = (v) => {
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(v);
  return m ? m.slice(1, 4).map(Number) : null;
};
const compare = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
const format = (v) => v.join('.');

const tags = git('tag', '--list', 'v*')
  .split('\n')
  .map(parse)
  .filter(Boolean)
  .sort(compare);
const highest = tags.at(-1) ?? [0, 0, 0];

const [mode, arg, explicit] = process.argv.slice(2);
let next;

if (mode === 'start') {
  if (explicit) {
    next = parse(explicit);
    if (!next || next[2] !== 0) fail(`Version "${explicit}" must look like X.Y.0`);
  } else if (arg === 'major') {
    next = [highest[0] + 1, 0, 0];
  } else if (arg === 'minor') {
    next = [highest[0], highest[1] + 1, 0];
  } else {
    fail(`Unknown bump "${arg}" (minor or major)`);
  }
  if (compare(next, highest) <= 0) fail(`${format(next)} is not higher than the last release ${format(highest)}`);
  const branch = `release/${next[0]}.${next[1]}`;
  if (git('ls-remote', '--heads', 'origin', branch)) fail(`Branch ${branch} exists already – use "Release: Bugfix" on it`);
} else if (mode === 'patch') {
  const m = /^release\/(\d+)\.(\d+)$/.exec(arg ?? '');
  if (!m) fail(`Run this workflow on a release/X.Y branch (got "${arg}")`);
  const [major, minor] = [Number(m[1]), Number(m[2])];
  const line = tags.filter((t) => t[0] === major && t[1] === minor);
  if (!line.length) fail(`No v${major}.${minor}.* tag yet – the branch was not created by "Release: Start"`);
  const last = line.at(-1);
  const pending = Number(git('rev-list', '--count', `v${format(last)}..HEAD`));
  if (!pending) fail(`No commits on ${arg} since v${format(last)} – nothing to release`);
  next = [major, minor, last[2] + 1];
} else {
  fail('Usage: release-version.mjs start <minor|major> [X.Y.0] | patch <release/X.Y>');
}

const out = {
  version: format(next),
  tag: `v${format(next)}`,
  branch: `release/${next[0]}.${next[1]}`,
  minor: `${next[0]}.${next[1]}`,
  latest: String(compare(next, highest) > 0),
};
console.log(out);
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, Object.entries(out).map(([k, v]) => `${k}=${v}\n`).join(''));
}
