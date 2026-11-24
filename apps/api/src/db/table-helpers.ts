import { sql, type SQL } from 'drizzle-orm';
import type { AnyMySqlColumn, MySqlInsertValue, MySqlTable } from 'drizzle-orm/mysql-core';
import { ProblemException } from '../common/problem-details/problem.exception';
import type { Database, Tx } from './database';

/** Replaces the child rows selected by `where`; an empty list only deletes. */
export async function replaceRows<T extends MySqlTable>(tx: Database | Tx, table: T, where: SQL | undefined, rows: MySqlInsertValue<T>[]): Promise<void> {
  await tx.delete(table).where(where);
  if (rows.length) await tx.insert(table).values(rows);
}

/** The position after the highest one of the column, `0` for no rows. */
export async function nextPosition(tx: Database | Tx, column: AnyMySqlColumn, where?: SQL): Promise<number> {
  const [{ next }] = await tx
    .select({ next: sql<number>`coalesce(max(${column}) + 1, 0)` })
    .from(column.table)
    .where(where);
  return next;
}

/** `given` must contain every current id exactly once (409 `conflict` otherwise). */
export function assertPermutation(current: readonly string[], given: readonly string[], detail: string): void {
  const ok = given.length === current.length && new Set(given).size === given.length && given.every((id) => current.includes(id));
  if (!ok) throw ProblemException.conflict('conflict', detail);
}
