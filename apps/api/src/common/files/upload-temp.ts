import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';

/** Temp directory multer writes uploads to; files are deleted after each request. */
export const UPLOAD_TEMP_DIR = resolve(join(tmpdir(), 'vmweb-uploads'));

export function ensureUploadTempDir(): string {
  mkdirSync(UPLOAD_TEMP_DIR, { recursive: true });
  return UPLOAD_TEMP_DIR;
}

/**
 * Path of a multer temp file, checked to lie inside {@link UPLOAD_TEMP_DIR}.
 * Multer generates these names itself; the check guards against a misconfigured storage
 * ever handing a request-controlled path to `readFile`/`rm`.
 */
export function uploadTempPath(path: string): string {
  const resolved = resolve(path);
  if (!resolved.startsWith(UPLOAD_TEMP_DIR + sep)) throw new Error('Upload file outside the upload temp directory');
  return resolved;
}
