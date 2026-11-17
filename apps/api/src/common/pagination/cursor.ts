import type { Page } from '@vm-web/shared';
import { ProblemException } from '../problem-details/problem.exception';

/**
 * Opaque keyset cursors: base64url JSON of the sort key of the last item, e.g. `["2026-12-24", "<id>"]`.
 * Clients must not build or interpret them.
 */
export type CursorKey = readonly (string | number | null)[];

export function encodeCursor(key: CursorKey): string {
  return Buffer.from(JSON.stringify(key), 'utf8').toString('base64url');
}

/** Decodes a cursor with the expected number of key parts; invalid cursors are a 400 on `/query/cursor`. */
export function decodeCursor(cursor: string | undefined, parts: number): CursorKey | undefined {
  if (cursor === undefined) return undefined;
  try {
    const key: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (
      Array.isArray(key) &&
      key.length === parts &&
      key.every((v) => v === null || typeof v === 'string' || typeof v === 'number')
    ) {
      return key as CursorKey;
    }
  } catch {
    // fall through
  }
  throw ProblemException.validation([{ path: '/query/cursor', code: 'invalid_cursor' }], 'Invalid cursor');
}

/**
 * Builds a page from `limit + 1` fetched rows: the extra row only signals that there is more.
 */
export function toPage<R, T>(rows: readonly R[], limit: number, keyOf: (row: R) => CursorKey, map: (row: R) => T): Page<T> {
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  return {
    items: items.map(map),
    nextCursor: rows.length > limit && last !== undefined ? encodeCursor(keyOf(last)) : null,
  };
}
