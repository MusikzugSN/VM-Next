import { bigint, index, integer, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { scores } from './scores';
import { users } from './users';
import { voices } from './voices';

export const uploadStatus = pgEnum('upload_status', ['pending', 'approved', 'rejected']);

/** Uploaded PDFs until the review decides, then their history (N-10..N-14). */
export const uploads = pgTable(
  'uploads',
  {
    id: uuid('id').primaryKey(),
    uploadedBy: uuid('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
    fileName: text('file_name').notNull(),
    /** Original file; `null` once it has been cleaned up. */
    fileKey: text('file_key'),
    pageCount: integer('page_count').notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    scoreId: uuid('score_id').references(() => scores.id, { onDelete: 'set null' }),
    voiceId: uuid('voice_id').references(() => voices.id, { onDelete: 'set null' }),
    status: uploadStatus('status').notNull().default('pending'),
    rejectionReason: text('rejection_reason'),
    decidedBy: uuid('decided_by').references(() => users.id, { onDelete: 'set null' }),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('uploads_status_created_idx').on(t.status, t.createdAt, t.id), index('uploads_uploader_idx').on(t.uploadedBy, t.createdAt)],
);
