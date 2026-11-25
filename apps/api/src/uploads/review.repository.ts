import { Inject, Injectable } from '@nestjs/common';
import { and, asc, count, desc, eq, ne, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/mysql-core';
import type { CursorKey } from '../common/pagination/cursor';
import { uuidv7 } from '../common/ids/uuid-v7';
import { DATABASE, type Database, type Tx } from '../db/database';
import { scores, sheets, uploads, users, voices } from '../db/schema';

const uploader = alias(users, 'uploader');

export type UploadState = 'not-found' | 'not-pending';

export interface ApproveInput {
  uploadId: string;
  scoreId: string;
  voiceId: string;
  fileKey: string;
  pageCount: number;
  sizeBytes: number;
  approvedBy: string;
  replaceExisting: boolean;
  mayReplace: boolean;
}

export type ApproveOutcome =
  | { kind: 'approved'; sheetId: string; replacedFileKey: string | null }
  | { kind: UploadState | 'sheet-exists' | 'replace-forbidden' };

@Injectable()
export class ReviewRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async queue(cursor: CursorKey | undefined, limit: number) {
    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select({
          uploadId: uploads.id,
          fileName: uploads.fileName,
          createdAt: uploads.createdAt,
          uploadedBy: { id: uploader.id, name: uploader.name },
          pageCount: uploads.pageCount,
          score: { id: scores.id, name: scores.title },
          voice: { id: voices.id, name: voices.name },
        })
        .from(uploads)
        .leftJoin(uploader, eq(uploader.id, uploads.uploadedBy))
        .leftJoin(scores, eq(scores.id, uploads.scoreId))
        .leftJoin(voices, eq(voices.id, uploads.voiceId))
        .where(and(eq(uploads.status, 'pending'), cursor ? sql`(${uploads.createdAt}, ${uploads.id}) > (${cursor[0]}, ${cursor[1]})` : undefined))
        .orderBy(asc(uploads.createdAt), asc(uploads.id))
        .limit(limit),
      this.db.select({ total: count() }).from(uploads).where(eq(uploads.status, 'pending')),
    ]);
    return { rows, total };
  }

  async details(uploadId: string) {
    const [row] = await this.db
      .select({
        uploadId: uploads.id,
        fileName: uploads.fileName,
        status: uploads.status,
        createdAt: uploads.createdAt,
        uploadedBy: { id: uploader.id, name: uploader.name },
        pageCount: uploads.pageCount,
        score: { id: scores.id, name: scores.title },
        voice: { id: voices.id, name: voices.name },
        existingSheetId: sql<string | null>`(select s.id from sheets s where s.score_id = ${uploads.scoreId} and s.voice_id = ${uploads.voiceId})`,
      })
      .from(uploads)
      .leftJoin(uploader, eq(uploader.id, uploads.uploadedBy))
      .leftJoin(scores, eq(scores.id, uploads.scoreId))
      .leftJoin(voices, eq(voices.id, uploads.voiceId))
      .where(eq(uploads.id, uploadId));
    return row;
  }

  async upload(uploadId: string) {
    const [row] = await this.db.select().from(uploads).where(eq(uploads.id, uploadId));
    return row;
  }

  async targetsExist(scoreId: string, voiceId: string): Promise<{ score: boolean; voice: boolean }> {
    const [[score], [voice]] = await Promise.all([
      this.db.select({ id: scores.id }).from(scores).where(eq(scores.id, scoreId)),
      this.db.select({ id: voices.id }).from(voices).where(eq(voices.id, voiceId)),
    ]);
    return { score: !!score, voice: !!voice };
  }

  async approve(input: ApproveInput): Promise<ApproveOutcome> {
    return this.db.transaction(async (tx): Promise<ApproveOutcome> => {
      const state = await this.lockPending(tx, input.uploadId);
      if (state) return { kind: state };
      const now = new Date();
      const [existing] = await tx
        .select({ id: sheets.id, fileKey: sheets.fileKey })
        .from(sheets)
        .where(and(eq(sheets.scoreId, input.scoreId), eq(sheets.voiceId, input.voiceId)))
        .for('update');
      const values = {
        fileKey: input.fileKey,
        pageCount: input.pageCount,
        sizeBytes: input.sizeBytes,
        uploadId: input.uploadId,
        approvedBy: input.approvedBy,
        approvedAt: now,
      };
      let sheetId: string;
      if (existing) {
        if (!input.replaceExisting) return { kind: 'sheet-exists' };
        if (!input.mayReplace) return { kind: 'replace-forbidden' };
        await tx.update(sheets).set(values).where(eq(sheets.id, existing.id));
        sheetId = existing.id;
      } else {
        sheetId = uuidv7();
        await tx.insert(sheets).values({ id: sheetId, scoreId: input.scoreId, voiceId: input.voiceId, ...values });
      }
      await tx
        .update(uploads)
        .set({ status: 'approved', scoreId: input.scoreId, voiceId: input.voiceId, decidedBy: input.approvedBy, decidedAt: now, rejectionReason: null })
        .where(eq(uploads.id, input.uploadId));
      return { kind: 'approved', sheetId, replacedFileKey: existing ? existing.fileKey : null };
    });
  }

  async reject(uploadId: string, userId: string, reason: string): Promise<UploadState | null> {
    return this.db.transaction(async (tx) => {
      const state = await this.lockPending(tx, uploadId);
      if (state) return state;
      await tx
        .update(uploads)
        .set({ status: 'rejected', rejectionReason: reason, decidedBy: userId, decidedAt: new Date() })
        .where(eq(uploads.id, uploadId));
      return null;
    });
  }

  async neighbour(uploadId: string, direction: 'previous' | 'next'): Promise<string | null> {
    const [ref] = await this.db.select({ createdAt: uploads.createdAt }).from(uploads).where(eq(uploads.id, uploadId));
    if (!ref) return null;
    const created = ref.createdAt.toISOString();
    const after = sql`(${uploads.createdAt}, ${uploads.id}) > (${created}, ${uploadId})`;
    const before = sql`(${uploads.createdAt}, ${uploads.id}) < (${created}, ${uploadId})`;
    const pick = async (cond: SQL | undefined, sort: typeof asc) => {
      const [row] = await this.db
        .select({ id: uploads.id })
        .from(uploads)
        .where(and(eq(uploads.status, 'pending'), ne(uploads.id, uploadId), cond))
        .orderBy(sort(uploads.createdAt), sort(uploads.id))
        .limit(1);
      return row?.id ?? null;
    };
    if (direction === 'previous') return pick(before, desc);
    return (await pick(after, asc)) ?? (await pick(undefined, asc));
  }

  private async lockPending(tx: Tx, uploadId: string): Promise<UploadState | null> {
    const [row] = await tx.select({ status: uploads.status }).from(uploads).where(eq(uploads.id, uploadId)).for('update');
    if (!row) return 'not-found';
    return row.status === 'pending' ? null : 'not-pending';
  }
}
