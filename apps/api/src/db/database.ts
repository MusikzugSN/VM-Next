import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from './schema';

export type Database = NodePgDatabase<typeof schema>;

/** The handle passed to a `db.transaction` callback. */
export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

/** Inject with `@Inject(DATABASE) db: Database`. */
export const DATABASE = Symbol('Database');
export const PG_POOL = Symbol('PgPool');
