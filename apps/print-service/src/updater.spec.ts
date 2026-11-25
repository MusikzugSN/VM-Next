import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ReleaseUpdater, UpdateError, parseChecksums, type UpdaterDeps } from './updater';

const RELEASES = 'https://github.example/releases';
const ARCHIVE = new TextEncoder().encode('fake tar.gz');
const NAME = 'vm-web-print-1.2.0-linux-x64';
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

describe('ReleaseUpdater', () => {
  let dir: string;
  let binary: string;
  let requested: string[];
  let files: Map<string, Uint8Array | string>;
  let extracted: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'vmweb-update-'));
    binary = join(dir, 'vm-web-print');
    await writeFile(binary, 'old');
    requested = [];
    extracted = 'new';
    files = new Map<string, Uint8Array | string>([
      [`${RELEASES}/download/v1.2.0/SHA256SUMS`, `${sha(ARCHIVE)}  ${NAME}.tar.gz\n${'0'.repeat(64)}  docker-compose.yml\n`],
      [`${RELEASES}/download/v1.2.0/${NAME}.tar.gz`, ARCHIVE],
    ]);
  });

  afterEach(() => rm(dir, { recursive: true, force: true }));

  function updater(extra: Partial<UpdaterDeps> = {}) {
    return new ReleaseUpdater({
      current: '1.1.0',
      binaryPath: binary,
      arch: 'x64',
      releases: RELEASES,
      fetch: (async (url: string) => {
        requested.push(url);
        const body = files.get(url);
        return body === undefined ? new Response('not found', { status: 404 }) : new Response(body);
      }) as typeof fetch,
      // Stands in for `tar -xzf <archive> -C <dir>`: puts the binary where the archive would.
      run: async (_command, args) => {
        const target = join(args[args.indexOf('-C') + 1], NAME);
        await mkdir(target, { recursive: true });
        await writeFile(join(target, 'vm-web-print'), extracted);
        return '';
      },
      ...extra,
    });
  }

  const code = (promise: Promise<unknown>) =>
    promise.then(
      () => 'ok',
      (error: unknown) => (error instanceof UpdateError ? error.code : String(error)),
    );

  it('replaces the binary with the checked release archive', async () => {
    await updater().update('1.2.0');
    expect(await readFile(binary, 'utf8')).toBe('new');
    expect(requested).toEqual([`${RELEASES}/download/v1.2.0/SHA256SUMS`, `${RELEASES}/download/v1.2.0/${NAME}.tar.gz`]);
  });

  it('only updates to newer release versions', async () => {
    expect(await code(updater().update('1.1.0'))).toBe('update-invalid-version');
    expect(await code(updater().update('1.0.9'))).toBe('update-invalid-version');
    expect(await code(updater().update('1.2.0-rc.1'))).toBe('update-invalid-version');
    expect(requested).toEqual([]);
  });

  it('refuses to update development builds and unknown installations', async () => {
    expect(await code(updater({ binaryPath: null }).update('1.2.0'))).toBe('update-unsupported');
    expect(await code(updater({ current: '0.0.0-dev' }).update('1.2.0'))).toBe('update-unsupported');
    expect(await code(updater({ arch: 'ia32' }).update('1.2.0'))).toBe('update-unsupported');
  });

  it('keeps the old binary when the checksum does not match', async () => {
    files.set(`${RELEASES}/download/v1.2.0/${NAME}.tar.gz`, new TextEncoder().encode('tampered'));
    expect(await code(updater().update('1.2.0'))).toBe('update-failed');
    expect(await readFile(binary, 'utf8')).toBe('old');
  });

  it('fails when the release or its archive is missing', async () => {
    expect(await code(updater().update('1.3.0'))).toBe('update-failed');
    files.set(`${RELEASES}/download/v1.2.0/SHA256SUMS`, `${'0'.repeat(64)}  other.tar.gz\n`);
    expect(await code(updater().update('1.2.0'))).toBe('update-failed');
    expect(await readFile(binary, 'utf8')).toBe('old');
  });

  it('runs one update at a time', async () => {
    const shared = updater();
    const [first, second] = await Promise.all([code(shared.update('1.2.0')), code(shared.update('1.2.0'))]);
    expect([first, second].sort()).toEqual(['ok', 'update-running']);
  });
});

describe('parseChecksums', () => {
  it('reads sha256sum output in text and binary mode', () => {
    const a = 'a'.repeat(64);
    const b = 'B'.repeat(64);
    expect(parseChecksums(`${a}  one.tar.gz\n${b} *two.tar.gz\nnonsense\n`)).toEqual(
      new Map([
        ['one.tar.gz', a],
        ['two.tar.gz', 'b'.repeat(64)],
      ]),
    );
  });
});
