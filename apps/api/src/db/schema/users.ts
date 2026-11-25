import { sql } from 'drizzle-orm';
import { boolean, timestamp, index, mysqlEnum, mysqlTable, text, varchar } from 'drizzle-orm/mysql-core';

const USER_STATUSES = ['active', 'blocked'] as const;

/** Accounts; name, e-mail and picture come from the identity server on every login (A-3, A-4). */
export const users = mysqlTable(
  'users',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    oidcSub: varchar('oidc_sub', { length: 255 }).notNull().unique(),
    name: varchar('name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }),
    pictureUrl: text('picture_url'),
    isAdmin: boolean('is_admin').notNull().default(false),
    status: mysqlEnum('status', USER_STATUSES).notNull().default('active'),
    lastLoginAt: timestamp('last_login_at', { fsp: 6 }),
    createdAt: timestamp('created_at', { fsp: 6 }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { fsp: 6 }).notNull().defaultNow(),
  },
  (t) => [index('users_name_idx').on(sql`lower(${t.name})`), index('users_email_idx').on(sql`lower(${t.email})`)],
);
