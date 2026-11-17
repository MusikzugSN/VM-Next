import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, join, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { assertValidKey, FileNotFoundError, type IFileStorage } from './file-storage';

/** `IFileStorage` on a directory (Docker volume in production). */
export class FsFileStorage implements IFileStorage {
  private readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  async init(): Promise<void> {
    await mkdir(join(this.root, '.tmp'), { recursive: true });
  }

  async write(key: string, data: Buffer | Readable): Promise<{ size: number }> {
    const target = this.pathFor(key);
    const tmp = join(this.root, '.tmp', randomUUID());
    await mkdir(dirname(target), { recursive: true });
    try {
      const source = Buffer.isBuffer(data) ? Readable.from([data]) : data;
      await pipeline(source, createWriteStream(tmp, { flags: 'wx' }));
      await rename(tmp, target);
    } catch (error) {
      await rm(tmp, { force: true });
      throw error;
    }
    return { size: (await stat(target)).size };
  }

  async read(key: string): Promise<Readable> {
    const path = this.pathFor(key);
    if (!(await this.stat(key))) throw new FileNotFoundError(key);
    return createReadStream(path);
  }

  async stat(key: string): Promise<{ size: number } | null> {
    try {
      const s = await stat(this.pathFor(key));
      return s.isFile() ? { size: s.size } : null;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }

  private pathFor(key: string): string {
    assertValidKey(key);
    const path = resolve(this.root, ...key.split('/'));
    // defence in depth: the key pattern already forbids leaving the root
    if (!path.startsWith(this.root + sep)) throw new Error(`Invalid storage key: ${JSON.stringify(key)}`);
    return path;
  }
}
