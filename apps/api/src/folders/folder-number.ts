import { sql } from 'drizzle-orm';
import { naturalSortKey } from '../common/natural-sort';
import { folderEntries } from '../db/schema';

/**
 * Sort key of a folder entry (N-5): natural key of the number, then the suffix,
 * so `1` < `1a` < `1b` < `2` < `10`.
 */
export function folderNumberSortKey(number: string, suffix: string | null | undefined): string {
  return naturalSortKey(number) + (suffix ?? '').toLowerCase();
}

/** Number and suffix as shown (`1a`), for selects where only the display value is needed. */
export const displayFolderNumber = sql<string>`concat(${folderEntries.number}, coalesce(${folderEntries.numberSuffix}, ''))`;
