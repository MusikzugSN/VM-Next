import type { MySql2Database } from 'drizzle-orm/mysql2';
import type * as schema from './schema';

export type Database = MySql2Database<typeof schema>;

/** The handle passed to a `db.transaction` callback. */
export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

/** Inject with `@Inject(DATABASE) db: Database`. */
export const DATABASE = Symbol('Database');
export const DB_POOL = Symbol('DbPool');
