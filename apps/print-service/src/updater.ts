import { createHash } from 'node:crypto';
import { chmod, copyFile, mkdtemp, rename, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { isSea } from 'node:sea';

import { PRINT_SERVICE_RELEASES, compareVersions, isReleaseVersion, type PrintServiceError } from '@vm-web/shared';

import { runCommand, type Run } from './cups-backend';

/** The release archive is about 40 MB; anything far larger is not ours. */
export const MAX_ARCHIVE_BYTES = 300 * 1024 * 1024;
const BINARY = 'vm-web-print';

export class UpdateError extends Error {
  constructor(
    readonly status: number,
    readonly code: PrintServiceError['code'],
    message: string,
  ) {
    super(message);
  }
}

export interface UpdaterDeps {
  /** Version of the running service. */
  current: string;
  /** Path of the installed binary to replace, `null` if this is no installed release (dev, `nx serve`, other OS). */
  binaryPath: string | null;
  /** `x64` or `arm64`, as in the archive name. */
  arch: string;
  fetch: typeof fetch;
  run: Run;
  /** Base of the GitHub releases, e.g. `https://github.com/MusikzugSN/VM-Next/releases`. */
  releases: string;
}

/** Self-update of the print service (POST /v1/update, docs/print-service.md). */
export interface Updater {
  /** Replaces the binary with release `version`; the caller restarts the process afterwards. */
  update(version: string): Promise<void>;
}

/** Where the running binary lives, if it is the single executable from the release archive on Linux. */
export function installedBinary(): string | null {
  return process.platform === 'linux' && isSea() ? process.execPath : null;
}

export function defaultUpdaterDeps(current: string): UpdaterDeps {
  return {
    current,
    binaryPath: installedBinary(),
    arch: process.arch,
    fetch: globalThis.fetch,
    run: runCommand,
    releases: PRINT_SERVICE_RELEASES,
  };
}

/**
 * Loads `vm-web-print-<version>-linux-<arch>.tar.gz` from release `v<version>`, checks it against the
 * release's `SHA256SUMS` and replaces the installed binary atomically (rename in the same folder),
 * like `install.sh` does. Configuration, unit file and history stay as they are.
 */
export class ReleaseUpdater implements Updater {
  private running = false;

  constructor(private readonly deps: UpdaterDeps) {}

  async update(version: string): Promise<void> {
    const { current, binaryPath, arch } = this.deps;
    if (!binaryPath || !isReleaseVersion(current) || (arch !== 'x64' && arch !== 'arm64')) {
      throw new UpdateError(400, 'update-unsupported', 'Dieser Druckservice kann sich nicht selbst aktualisieren. Bitte das Archiv aus dem Release installieren.');
    }
    if (!isReleaseVersion(version) || compareVersions(version, current) <= 0) {
      throw new UpdateError(400, 'update-invalid-version', `Version ${version} ist nicht neuer als ${current}.`);
    }
    if (this.running) throw new UpdateError(409, 'update-running', 'Es läuft schon ein Update.');

    this.running = true;
    const work = await mkdtemp(join(tmpdir(), 'vm-web-print-update-'));
    try {
      const name = `${BINARY}-${version}-linux-${arch}`;
      const base = `${this.deps.releases}/download/v${version}`;
      const sums = parseChecksums(new TextDecoder().decode(await this.download(`${base}/SHA256SUMS`, 64 * 1024)));
      const expected = sums.get(`${name}.tar.gz`);
      if (!expected) throw new UpdateError(502, 'update-failed', `Im Release v${version} fehlt ${name}.tar.gz.`);

      const archive = await this.download(`${base}/${name}.tar.gz`, MAX_ARCHIVE_BYTES);
      if (createHash('sha256').update(archive).digest('hex') !== expected) {
        throw new UpdateError(502, 'update-failed', 'Die Prüfsumme des geladenen Archivs stimmt nicht.');
      }
      const archivePath = join(work, `${name}.tar.gz`);
      await writeFile(archivePath, archive);
      await this.deps.run('tar', ['-xzf', archivePath, '-C', work]);

      const extracted = join(work, name, BINARY);
      if (!(await stat(extracted).catch(() => null))?.isFile()) {
        throw new UpdateError(502, 'update-failed', `Im Archiv fehlt ${name}/${BINARY}.`);
      }
      // Replace atomically, so a crash never leaves half a binary behind
      const next = join(dirname(binaryPath), `.${BINARY}.new`);
      await copyFile(extracted, next);
      await chmod(next, 0o755);
      await rename(next, binaryPath);
    } catch (error) {
      if (error instanceof UpdateError) throw error;
      throw new UpdateError(500, 'update-failed', `Update fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.running = false;
      await rm(work, { recursive: true, force: true });
    }
  }

  private async download(url: string, limit: number): Promise<Uint8Array> {
    let response: Response;
    try {
      response = await this.deps.fetch(url, { signal: AbortSignal.timeout(5 * 60_000) });
    } catch (error) {
      throw new UpdateError(502, 'update-failed', `Download nicht möglich (${url}): ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!response.ok) throw new UpdateError(502, 'update-failed', `Download nicht möglich (${url}): HTTP ${response.status}.`);
    const length = Number(response.headers.get('content-length') ?? 0);
    if (length > limit) throw new UpdateError(502, 'update-failed', `Download zu groß (${url}).`);
    const body = new Uint8Array(await response.arrayBuffer());
    if (body.byteLength > limit) throw new UpdateError(502, 'update-failed', `Download zu groß (${url}).`);
    return body;
  }
}

/** `sha256sum` output (`<hex>  <file>` or `<hex> *<file>`) → file name → hash. */
export function parseChecksums(text: string): Map<string, string> {
  const sums = new Map<string, string>();
  for (const line of text.split('\n')) {
    const match = /^([0-9a-f]{64}) [ *](.+)$/i.exec(line.trim());
    if (match) sums.set(match[2].trim(), match[1].toLowerCase());
  }
  return sums;
}
