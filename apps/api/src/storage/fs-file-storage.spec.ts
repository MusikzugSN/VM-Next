import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { text } from 'node:stream/consumers';
import { FileNotFoundError } from './file-storage';
import { FsFileStorage } from './fs-file-storage';

describe('FsFileStorage', () => {
  let root: string;
  let storage: FsFileStorage;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'vmweb-storage-'));
    storage = new FsFileStorage(root);
    await storage.init();
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('writes buffers and streams, reads and stats them', async () => {
    expect(await storage.write('sheets/a.pdf', Buffer.from('%PDF-1'))).toEqual({ size: 6 });
    await storage.write('uploads/b.pdf', Readable.from(['%PDF', '-2']));
    expect(await text(await storage.read('sheets/a.pdf'))).toBe('%PDF-1');
    expect(await storage.stat('uploads/b.pdf')).toEqual({ size: 6 });
  });

  it('replaces existing files and leaves no temp files', async () => {
    await storage.write('logo.png', Buffer.from('old'));
    await storage.write('logo.png', Buffer.from('new!'));
    expect(await text(await storage.read('logo.png'))).toBe('new!');
    expect(await readdir(join(root, '.tmp'))).toEqual([]);
  });

  it('reports missing files', async () => {
    expect(await storage.stat('missing.pdf')).toBeNull();
    await expect(storage.read('missing.pdf')).rejects.toBeInstanceOf(FileNotFoundError);
    await expect(storage.delete('missing.pdf')).resolves.toBeUndefined();
  });

  it('deletes files', async () => {
    await storage.write('x.pdf', Buffer.from('x'));
    await storage.delete('x.pdf');
    expect(await storage.stat('x.pdf')).toBeNull();
  });

  it.each(['../escape.pdf', 'a/../../b', '/abs.pdf', 'C:/x.pdf', 'a\\b.pdf', 'Upper.pdf', '', 'a//b', './a'])(
    'rejects invalid key %j',
    async (key) => {
      await expect(storage.write(key, Buffer.from('x'))).rejects.toThrow(/Invalid storage key/);
    },
  );

  it('cleans up the temp file when the source stream fails', async () => {
    const failing = new Readable({
      read() {
        this.destroy(new Error('boom'));
      },
    });
    await expect(storage.write('broken.pdf', failing)).rejects.toThrow('boom');
    expect(await storage.stat('broken.pdf')).toBeNull();
    expect(await readdir(join(root, '.tmp'))).toEqual([]);
  });
});
