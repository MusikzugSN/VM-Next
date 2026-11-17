import { sql } from 'drizzle-orm';
import { boolean, check, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { ensembles } from './ensembles';
import { roles } from './roles';

/** Club configuration, exactly one row with `id = 1` (S-4). */
export const clubSettings = pgTable(
  'club_settings',
  {
    id: integer('id').primaryKey().default(1),
    clubName: text('club_name').notNull(),
    imprintUrl: text('imprint_url'),
    privacyUrl: text('privacy_url'),
    loginBanner: text('login_banner'),
    loginAutoRedirect: boolean('login_auto_redirect').notNull().default(false),
    logoFileKey: text('logo_file_key'),
    logoMime: text('logo_mime'),
    defaultEnsembleId: uuid('default_ensemble_id').references(() => ensembles.id, { onDelete: 'set null' }),
    defaultRoleId: uuid('default_role_id').references(() => roles.id, { onDelete: 'set null' }),
    browserPrintPageLimit: integer('browser_print_page_limit').notNull().default(10),
    publicBaseUrl: text('public_base_url'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check('club_settings_single_row_check', sql`${t.id} = 1`)],
);
