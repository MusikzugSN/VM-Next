import { sql } from 'drizzle-orm';
import { boolean, index, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const userStatus = pgEnum('user_status', ['active', 'blocked']);

/** Accounts; name, e-mail and picture come from the identity server on every login (A-3, A-4). */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey(),
    oidcSub: text('oidc_sub').notNull().unique(),
    name: text('name').notNull(),
    email: text('email'),
    pictureUrl: text('picture_url'),
    isAdmin: boolean('is_admin').notNull().default(false),
    status: userStatus('status').notNull().default('active'),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('users_name_idx').on(sql`lower(${t.name})`), index('users_email_idx').on(sql`lower(${t.email})`)],
);
