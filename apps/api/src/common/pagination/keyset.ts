import { sql, type SQL, type SQLWrapper } from 'drizzle-orm';
import type { CursorKey } from './cursor';

/** Keyset condition for lists sorted by `lower(name), id`; no condition on the first page. */
export function afterNameAndId(name: SQLWrapper, id: SQLWrapper, cursor: CursorKey | undefined): SQL | undefined {
  return cursor ? sql`(lower(${name}), ${id}) > (${cursor[0]}, ${cursor[1]}::uuid)` : undefined;
}
