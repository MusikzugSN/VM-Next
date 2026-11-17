import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from './schema';

export type Database = NodePgDatabase<typeof schema>;

/** Inject with `@Inject(DATABASE) db: Database`. */
export const DATABASE = Symbol('Database');
export const PG_POOL = Symbol('PgPool');
