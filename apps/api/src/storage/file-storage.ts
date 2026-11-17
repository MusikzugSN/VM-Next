import type { Readable } from 'node:stream';

/**
 * Storage for binary files (sheet PDFs, uploads, logo). Inject with `@Inject(FILE_STORAGE)`.
 *
 * Keys are relative, lower-case paths like `sheets/0193….pdf` (see `assertValidKey`).
 */
export interface IFileStorage {
  /** Writes atomically; an existing file with the same key is replaced. */
  write(key: string, data: Buffer | Readable): Promise<{ size: number }>;
  /** Throws `FileNotFoundError` if the key does not exist. */
  read(key: string): Promise<Readable>;
  /** `null` if the key does not exist. */
  stat(key: string): Promise<{ size: number } | null>;
  /** Idempotent. */
  delete(key: string): Promise<void>;
}

export const FILE_STORAGE = Symbol('IFileStorage');

export class FileNotFoundError extends Error {
  constructor(readonly key: string) {
    super(`File not found: ${key}`);
    this.name = 'FileNotFoundError';
  }
}

const KEY_PATTERN = /^[a-z0-9][a-z0-9._-]*(\/[a-z0-9][a-z0-9._-]*)*$/;

/** Rejects absolute paths, `..`, backslashes, upper case and anything outside `[a-z0-9._-/]`. */
export function assertValidKey(key: string): void {
  if (key.length > 300 || !KEY_PATTERN.test(key) || key.split('/').some((part) => part === '..' || part === '.')) {
    throw new Error(`Invalid storage key: ${JSON.stringify(key)}`);
  }
}
