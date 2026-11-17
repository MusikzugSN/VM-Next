import { Inject, Injectable, Logger } from '@nestjs/common';
import type {
  ApproveUploadBody,
  ApproveUploadResponse,
  CursorQuery,
  RejectUploadResponse,
  ReviewQueueResponse,
  UploadDetailsResponse,
} from '@vm-web/shared';
import { and, asc, eq, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { Readable } from 'node:stream';
import type { AccessContext } from '../access/access-context';
import { uuidv7 } from '../common/ids/uuid-v7';
import { decodeCursor, encodeCursor } from '../common/pagination/cursor';
import { ProblemException } from '../common/problem-details/problem.exception';
import { DATABASE, type Database } from '../db/database';
import { scores, sheets, uploads, users, voices } from '../db/schema';
import { FILE_STORAGE, type IFileStorage } from '../storage/file-storage';
import { streamToBuffer } from '../storage/stream-utils';
import { buildSheetPdf } from './pdf-tools';
import { sheetKey } from './uploads.service';

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

const uploader = alias(users, 'uploader');

/** Review of pending uploads (N-12, N-13, N-14). Permission: `sheet.approve` in at least one ensemble. */
@Injectable()
export class ReviewService {
  private readonly logger = new Logger('Review');

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(FILE_STORAGE) private readonly storage: IFileStorage,
  ) {}

  /** Pending uploads, oldest first. */
  async queue(query: CursorQuery): Promise<ReviewQueueResponse> {
    const cursor = decodeCursor(query.cursor, 2);
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
        .where(
          and(
            eq(uploads.status, 'pending'),
            cursor ? sql`(${uploads.createdAt}, ${uploads.id}) > (${cursor[0]}::timestamptz, ${cursor[1]}::uuid)` : undefined,
          ),
        )
        .orderBy(asc(uploads.createdAt), asc(uploads.id))
        .limit(query.limit + 1),
      this.db.select({ total: sql<number>`count(*)::int` }).from(uploads).where(eq(uploads.status, 'pending')),
    ]);
    const page = rows.slice(0, query.limit);
    const last = page.at(-1);
    return {
      items: page.map(({ createdAt, ...r }) => ({ ...r, uploadedAt: createdAt.toISOString() })),
      nextCursor: rows.length > query.limit && last ? encodeCursor([last.createdAt.toISOString(), last.uploadId]) : null,
      totalPending: total,
    };
  }

  async details(uploadId: string): Promise<UploadDetailsResponse> {
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
    if (!row) throw ProblemException.notFound();
    const { createdAt, ...rest } = row;
    const [previousUploadId, nextUploadId] = await Promise.all([this.neighbour(uploadId, 'previous'), this.neighbour(uploadId, 'next')]);
    return { ...rest, uploadedAt: createdAt.toISOString(), previousUploadId, nextUploadId };
  }

  /** Original file for the pdf.js preview; rotation and crop are only applied on approval. */
  async originalFile(uploadId: string): Promise<{ stream: Readable; fileName: string }> {
    const [row] = await this.db.select({ fileKey: uploads.fileKey, fileName: uploads.fileName }).from(uploads).where(eq(uploads.id, uploadId));
    if (!row?.fileKey) throw ProblemException.notFound();
    const fileKey = row.fileKey;
    const stream = await this.storage.read(fileKey).catch(() => {
      this.logger.error(`Original ${fileKey} of upload ${uploadId} is missing in storage`);
      throw ProblemException.notFound();
    });
    return { stream, fileName: row.fileName };
  }

  /**
   * Approves an upload (N-12): builds the sheet from the chosen pages (rotated, cropped)
   * and assigns score and voice. One document per score and voice (F-11): an existing sheet is
   * only replaced with `replaceExisting`, which additionally needs `score.delete`.
   */
  async approve(access: AccessContext, uploadId: string, body: ApproveUploadBody): Promise<ApproveUploadResponse> {
    const upload = await this.pendingUpload(this.db, uploadId);
    const tooFar = body.pages.flatMap((p, i) => (p.sourcePage > upload.pageCount ? [{ path: `/body/pages/${i}/sourcePage`, code: 'too_big' }] : []));
    if (tooFar.length) throw ProblemException.validation(tooFar);
    await this.assertTargets(body.scoreId, body.voiceId);
    if (!upload.fileKey) throw ProblemException.notFound('Original file is gone');

    const original = await streamToBuffer(await this.storage.read(upload.fileKey));
    const pdf = await buildSheetPdf(original, body.pages);
    const newFileKey = sheetKey(uuidv7());
    await this.storage.write(newFileKey, Buffer.from(pdf.bytes));

    let replacedFileKey: string | null = null;
    let sheetId: string;
    try {
      sheetId = await this.db.transaction(async (tx) => {
        await this.pendingUpload(tx, uploadId, true);
        const now = new Date();
        const [existing] = await tx
          .select({ id: sheets.id, fileKey: sheets.fileKey })
          .from(sheets)
          .where(and(eq(sheets.scoreId, body.scoreId), eq(sheets.voiceId, body.voiceId)))
          .for('update');
        const values = {
          fileKey: newFileKey,
          pageCount: pdf.pageCount,
          sizeBytes: pdf.bytes.length,
          uploadId,
          approvedBy: access.userId,
          approvedAt: now,
        };
        let id: string;
        if (existing) {
          if (!body.replaceExisting) throw ProblemException.conflict('sheet-exists');
          if (!access.has('score.delete')) throw ProblemException.forbidden('Replacing a sheet needs score.delete');
          await tx.update(sheets).set(values).where(eq(sheets.id, existing.id));
          replacedFileKey = existing.fileKey;
          id = existing.id;
        } else {
          id = uuidv7();
          await tx.insert(sheets).values({ id, scoreId: body.scoreId, voiceId: body.voiceId, ...values });
        }
        await tx
          .update(uploads)
          .set({ status: 'approved', scoreId: body.scoreId, voiceId: body.voiceId, decidedBy: access.userId, decidedAt: now, rejectionReason: null })
          .where(eq(uploads.id, uploadId));
        return id;
      });
    } catch (error) {
      await this.storage.delete(newFileKey).catch(() => undefined);
      throw error;
    }
    if (replacedFileKey) await this.storage.delete(replacedFileKey).catch(() => undefined);
    return { sheetId, nextUploadId: await this.neighbour(uploadId, 'next') };
  }

  /** Rejects with a reason the uploader sees (N-12, N-14). */
  async reject(userId: string, uploadId: string, reason: string): Promise<RejectUploadResponse> {
    await this.db.transaction(async (tx) => {
      await this.pendingUpload(tx, uploadId, true);
      await tx
        .update(uploads)
        .set({ status: 'rejected', rejectionReason: reason, decidedBy: userId, decidedAt: new Date() })
        .where(eq(uploads.id, uploadId));
    });
    return { nextUploadId: await this.neighbour(uploadId, 'next') };
  }

  private async pendingUpload(db: Database | Tx, uploadId: string, lock = false) {
    const query = db.select().from(uploads).where(eq(uploads.id, uploadId));
    const [row] = lock ? await query.for('update') : await query;
    if (!row) throw ProblemException.notFound();
    if (row.status !== 'pending') throw ProblemException.conflict('upload-not-pending');
    return row;
  }

  private async assertTargets(scoreId: string, voiceId: string): Promise<void> {
    const [[score], [voice]] = await Promise.all([
      this.db.select({ id: scores.id }).from(scores).where(eq(scores.id, scoreId)),
      this.db.select({ id: voices.id }).from(voices).where(eq(voices.id, voiceId)),
    ]);
    if (!score) throw ProblemException.notFound('Unknown score');
    if (!voice) throw ProblemException.notFound('Unknown voice');
  }

  /**
   * Neighbour in the pending queue relative to an upload (also if that one is no longer pending);
   * `next` wraps around to the oldest pending upload so the reviewer can keep going.
   */
  private async neighbour(uploadId: string, direction: 'previous' | 'next'): Promise<string | null> {
    const [ref] = await this.db.select({ createdAt: uploads.createdAt }).from(uploads).where(eq(uploads.id, uploadId));
    if (!ref) return null;
    const created = ref.createdAt.toISOString();
    const after = sql`(${uploads.createdAt}, ${uploads.id}) > (${created}::timestamptz, ${uploadId}::uuid)`;
    const before = sql`(${uploads.createdAt}, ${uploads.id}) < (${created}::timestamptz, ${uploadId}::uuid)`;
    const pick = async (cond: ReturnType<typeof sql> | undefined, order: 'asc' | 'desc') => {
      const [row] = await this.db
        .select({ id: uploads.id })
        .from(uploads)
        .where(and(eq(uploads.status, 'pending'), sql`${uploads.id} <> ${uploadId}::uuid`, cond))
        .orderBy(order === 'asc' ? asc(uploads.createdAt) : sql`${uploads.createdAt} desc`, order === 'asc' ? asc(uploads.id) : sql`${uploads.id} desc`)
        .limit(1);
      return row?.id ?? null;
    };
    if (direction === 'previous') return pick(before, 'desc');
    return (await pick(after, 'asc')) ?? (await pick(undefined, 'asc'));
  }
}
