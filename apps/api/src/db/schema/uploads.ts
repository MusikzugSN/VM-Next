import { bigint, timestamp, index, int, mysqlEnum, mysqlTable, text, varchar } from 'drizzle-orm/mysql-core';
import { scores } from './scores';
import { users } from './users';
import { voices } from './voices';

const UPLOAD_STATUSES = ['pending', 'approved', 'rejected'] as const;

/** Uploaded PDFs until the review decides, then their history (N-10..N-14). */
export const uploads = mysqlTable(
  'uploads',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    uploadedBy: varchar('uploaded_by', { length: 36 }).references(() => users.id, { onDelete: 'set null' }),
    fileName: text('file_name').notNull(),
    /** Original file; `null` once it has been cleaned up. */
    fileKey: text('file_key'),
    pageCount: int('page_count').notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    scoreId: varchar('score_id', { length: 36 }).references(() => scores.id, { onDelete: 'set null' }),
    voiceId: varchar('voice_id', { length: 36 }).references(() => voices.id, { onDelete: 'set null' }),
    status: mysqlEnum('status', UPLOAD_STATUSES).notNull().default('pending'),
    rejectionReason: text('rejection_reason'),
    decidedBy: varchar('decided_by', { length: 36 }).references(() => users.id, { onDelete: 'set null' }),
    decidedAt: timestamp('decided_at', { fsp: 6 }),
    createdAt: timestamp('created_at', { fsp: 6 }).notNull().defaultNow(),
  },
  (t) => [index('uploads_status_created_idx').on(t.status, t.createdAt, t.id), index('uploads_uploader_idx').on(t.uploadedBy, t.createdAt)],
);
