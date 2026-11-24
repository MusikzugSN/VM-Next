import { sql } from 'drizzle-orm';
import { boolean, check, timestamp, int, mysqlTable, text, varchar } from 'drizzle-orm/mysql-core';
import { ensembles } from './ensembles';
import { roles } from './roles';

/** Club configuration, exactly one row with `id = 1` (S-4). */
export const clubSettings = mysqlTable(
  'club_settings',
  {
    id: int('id').primaryKey().default(1),
    clubName: text('club_name').notNull(),
    imprintUrl: text('imprint_url'),
    privacyUrl: text('privacy_url'),
    loginBanner: text('login_banner'),
    loginAutoRedirect: boolean('login_auto_redirect').notNull().default(false),
    logoFileKey: text('logo_file_key'),
    logoMime: text('logo_mime'),
    defaultEnsembleId: varchar('default_ensemble_id', { length: 36 }).references(() => ensembles.id, { onDelete: 'set null' }),
    defaultRoleId: varchar('default_role_id', { length: 36 }).references(() => roles.id, { onDelete: 'set null' }),
    browserPrintPageLimit: int('browser_print_page_limit').notNull().default(10),
    publicBaseUrl: text('public_base_url'),
    updatedAt: timestamp('updated_at', { fsp: 6 }).notNull().defaultNow(),
  },
  (t) => [check('club_settings_single_row_check', sql`${t.id} = 1`)],
);
