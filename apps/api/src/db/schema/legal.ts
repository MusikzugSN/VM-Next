import { sql } from 'drizzle-orm';
import { check, date, int, json, mysqlTable, text, timestamp, varchar } from 'drizzle-orm/mysql-core';

/**
 * Template accepted by admins (S-7): version, date and the template text itself, so the published
 * text stays the same after an update ships a new template version.
 */
export interface AcceptedLegalTemplate {
  version: number;
  date: string;
  /** Main template without front matter. */
  main: string;
  /** Module sections without front matter (privacy only), by `LegalModuleKey`. */
  modules: Record<string, string>;
}

/** Imprint and privacy policy, one row per document (S-7). */
export const legalDocuments = mysqlTable(
  'legal_documents',
  {
    document: varchar('document', { length: 16 }).primaryKey(),
    /** `link` | `generated`; `null` = not configured. */
    mode: varchar('mode', { length: 16 }),
    url: text('url'),
    acceptedTemplate: json('accepted_template').$type<AcceptedLegalTemplate>(),
    acceptedAt: timestamp('accepted_at', { fsp: 6 }),
    /** Hash of the last published HTML; when it changes, `as_of` moves to today („Stand“). */
    publishedHash: varchar('published_hash', { length: 64 }),
    asOf: date('as_of', { mode: 'string' }),
    updatedAt: timestamp('updated_at', { fsp: 6 }).notNull().defaultNow(),
  },
  (t) => [
    check('legal_documents_document_check', sql`${t.document} in ('imprint', 'privacy')`),
    check('legal_documents_mode_check', sql`${t.mode} is null or ${t.mode} in ('link', 'generated')`),
  ],
);

/**
 * Club data for the generated documents, exactly one row with `id = 1` (S-7).
 * Stored as JSON and validated with `imprintDataSchema` / `privacyDataSchema` on read and write.
 */
export const legalData = mysqlTable(
  'legal_data',
  {
    id: int('id').primaryKey().default(1),
    imprintData: json('imprint_data').notNull(),
    privacyData: json('privacy_data').notNull(),
    updatedAt: timestamp('updated_at', { fsp: 6 }).notNull().defaultNow(),
  },
  (t) => [check('legal_data_single_row_check', sql`${t.id} = 1`)],
);
