import { Inject, Injectable } from '@nestjs/common';
import {
  uploadSheetsMetaSchema,
  type Page,
  type ScoreSearchItem,
  type ScoreSearchQuery,
  type UploadSheetsResponse,
  type ValidationError,
  type VoiceSuggestionsResponse,
} from '@vm-web/shared';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { readFile, rm } from 'node:fs/promises';
import type { AccessContext } from '../access/access-context';
import { uuidv7 } from '../common/ids/uuid-v7';
import { decodeCursor, toPage } from '../common/pagination/cursor';
import { ProblemException } from '../common/problem-details/problem.exception';
import { toJsonPointer } from '../common/validation/zod-validation.pipe';
import { DATABASE, type Database } from '../db/database';
import { isUniqueViolation } from '../db/db-errors';
import { instruments, scores, sheets, uploads, voices } from '../db/schema';
import { likePattern } from '../common/sql';
import { MeRepository } from '../me/me.repository';
import { FILE_STORAGE, type IFileStorage } from '../storage/file-storage';
import { InvalidPdfError, inspectPdf } from './pdf-tools';
import { suggestVoice } from './voice-suggestion';
import { afterNameAndId } from '../common/pagination/keyset';

/** What the upload interceptor hands over per file (multer disk storage). */
export interface UploadedFileInfo {
  originalname: string;
  path: string;
  size: number;
}

export const uploadKey = (id: string) => `uploads/${id}.pdf`;
export const sheetKey = (id: string) => `sheets/${id}.pdf`;

/** Upload dialog (N-10, N-11, M-9, F-2, F-11). */
@Injectable()
export class UploadsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(MeRepository) private readonly me: MeRepository,
    @Inject(FILE_STORAGE) private readonly storage: IFileStorage,
  ) {}

  /** Voice proposed per file name; ties go to the earlier voice in list order (N-11). */
  async voiceSuggestions(fileNames: readonly string[]): Promise<VoiceSuggestionsResponse> {
    const candidates = await this.db
      .select({ id: voices.id, name: voices.name, instrumentId: voices.instrumentId })
      .from(voices)
      .innerJoin(instruments, eq(instruments.id, voices.instrumentId))
      .orderBy(asc(instruments.position), asc(voices.position));
    return {
      items: fileNames.map((fileName) => {
        const match = suggestVoice(fileName, candidates);
        return { fileName, voice: match ? (candidates.find((c) => c.id === match.id) ?? null) : null };
      }),
    };
  }

  /** All scores with `score.view`/`sheet.approve`, otherwise those visible in Mein Bereich (R-2). */
  async scoreSearch(access: AccessContext, query: ScoreSearchQuery): Promise<Page<ScoreSearchItem>> {
    const visible = this.visibleScoresSql(access);
    if (visible === null) return { items: [], nextCursor: null };
    const cursor = decodeCursor(query.cursor, 2);
    const pattern = likePattern(query.q);
    const rows = await this.db
      .select({
        id: scores.id,
        title: scores.title,
        composer: scores.composer,
        arranger: scores.arranger,
        sortKey: sql<string>`lower(${scores.title})`,
      })
      .from(scores)
      .where(
        and(
          sql`(${scores.title} ilike ${pattern} or ${scores.composer} ilike ${pattern} or ${scores.arranger} ilike ${pattern})`,
          visible,
          afterNameAndId(scores.title, scores.id, cursor),
        ),
      )
      .orderBy(sql`lower(${scores.title})`, asc(scores.id))
      .limit(query.limit + 1);
    return toPage(rows, query.limit, (r) => [r.sortKey, r.id], (r) => ({ id: r.id, title: r.title, composer: r.composer, arranger: r.arranger }));
  }

  /**
   * Stores the PDFs. With `sheet.approve`, score and voice set and no sheet yet for that pair,
   * an upload is approved at once (N-10, F-11); everything else waits in the review queue.
   */
  async upload(access: AccessContext, files: readonly UploadedFileInfo[], metaRaw: unknown): Promise<UploadSheetsResponse> {
    try {
      const meta = this.parseMeta(metaRaw, files.length);
      await this.checkTargets(access, meta.items);
      const contents = await this.readPdfs(files);

      const canApprove = access.has('sheet.approve');
      const items: UploadSheetsResponse['items'] = [];
      for (const [i, item] of meta.items.entries()) {
        const { bytes, pageCount } = contents[i];
        items.push(await this.storeOne(access.userId, canApprove, item, bytes, pageCount));
      }
      return { items };
    } finally {
      await Promise.all(files.map((f) => rm(f.path, { force: true })));
    }
  }

  private async storeOne(
    userId: string,
    canApprove: boolean,
    item: { fileName: string; scoreId: string | null; voiceId: string | null },
    bytes: Buffer,
    pageCount: number,
  ): Promise<UploadSheetsResponse['items'][number]> {
    const uploadId = uuidv7();
    const written: string[] = [];
    try {
      await this.storage.write(uploadKey(uploadId), bytes);
      written.push(uploadKey(uploadId));
      const autoApprove = canApprove && !!item.scoreId && !!item.voiceId;
      const sheetId = autoApprove ? uuidv7() : null;
      if (sheetId) {
        await this.storage.write(sheetKey(sheetId), bytes);
        written.push(sheetKey(sheetId));
      }

      const approved = await this.db.transaction(async (tx) => {
        const now = new Date();
        await tx.insert(uploads).values({
          id: uploadId,
          uploadedBy: userId,
          fileName: item.fileName,
          fileKey: uploadKey(uploadId),
          pageCount,
          sizeBytes: bytes.length,
          scoreId: item.scoreId,
          voiceId: item.voiceId,
          createdAt: now,
        });
        if (!sheetId || !item.scoreId || !item.voiceId) return false;
        const [existing] = await tx
          .select({ id: sheets.id })
          .from(sheets)
          .where(and(eq(sheets.scoreId, item.scoreId), eq(sheets.voiceId, item.voiceId)));
        if (existing) return false; // one document per score and voice: replacing is decided in the review
        await tx.insert(sheets).values({
          id: sheetId,
          scoreId: item.scoreId,
          voiceId: item.voiceId,
          fileKey: sheetKey(sheetId),
          pageCount,
          sizeBytes: bytes.length,
          uploadId,
          approvedBy: userId,
          approvedAt: now,
        });
        await tx.update(uploads).set({ status: 'approved', decidedBy: userId, decidedAt: now }).where(eq(uploads.id, uploadId));
        return true;
      }).catch((error: unknown) => {
        if (isUniqueViolation(error)) return 'retry-pending' as const;
        throw error;
      });

      if (approved === 'retry-pending') {
        // a sheet appeared concurrently: keep the upload pending without the auto-approval
        await this.db.insert(uploads).values({
          id: uploadId,
          uploadedBy: userId,
          fileName: item.fileName,
          fileKey: uploadKey(uploadId),
          pageCount,
          sizeBytes: bytes.length,
          scoreId: item.scoreId,
          voiceId: item.voiceId,
        });
      }
      if (sheetId && approved !== true) await this.storage.delete(sheetKey(sheetId));
      return { uploadId, fileName: item.fileName, status: approved === true ? 'approved' : 'pending', sheetId: approved === true ? sheetId : null, pageCount };
    } catch (error) {
      await Promise.all(written.map((key) => this.storage.delete(key).catch(() => undefined)));
      throw error;
    }
  }

  private parseMeta(raw: unknown, fileCount: number) {
    if (fileCount === 0) throw ProblemException.validation([{ path: '/files', code: 'too_small' }]);
    let json: unknown;
    try {
      json = typeof raw === 'string' ? JSON.parse(raw) : undefined;
    } catch {
      json = undefined;
    }
    const result = uploadSheetsMetaSchema.safeParse(json);
    if (!result.success) {
      throw ProblemException.validation(
        json === undefined
          ? [{ path: '/body/meta', code: 'invalid_json' }]
          : result.error.issues.map((i) => ({ path: toJsonPointer(['body', 'meta', ...i.path]), code: i.code })),
      );
    }
    if (result.data.items.length !== fileCount) {
      throw ProblemException.validation([{ path: '/body/meta/items', code: 'count_mismatch' }]);
    }
    return result.data;
  }

  /** Scores must be visible to the uploader, voices must exist (404 otherwise). */
  private async checkTargets(access: AccessContext, items: readonly { scoreId: string | null; voiceId: string | null }[]): Promise<void> {
    const scoreIds = [...new Set(items.map((i) => i.scoreId).filter((id): id is string => !!id))];
    const voiceIds = [...new Set(items.map((i) => i.voiceId).filter((id): id is string => !!id))];
    if (scoreIds.length) {
      const visible = this.visibleScoresSql(access);
      const found = visible === null ? [] : await this.db.select({ id: scores.id }).from(scores).where(and(inArray(scores.id, scoreIds), visible));
      if (found.length !== scoreIds.length) throw ProblemException.notFound('Unknown score');
    }
    if (voiceIds.length) {
      const found = await this.db.select({ id: voices.id }).from(voices).where(inArray(voices.id, voiceIds));
      if (found.length !== voiceIds.length) throw ProblemException.notFound('Unknown voice');
    }
  }

  /** Reads and checks every file before anything is stored; all problems in one 415. */
  private async readPdfs(files: readonly UploadedFileInfo[]): Promise<{ bytes: Buffer; pageCount: number }[]> {
    const errors: ValidationError[] = [];
    const result: { bytes: Buffer; pageCount: number }[] = [];
    for (const [i, file] of files.entries()) {
      const bytes = await readFile(file.path);
      try {
        result.push({ bytes, pageCount: (await inspectPdf(bytes)).pageCount });
      } catch (error) {
        if (!(error instanceof InvalidPdfError)) throw error;
        errors.push({ path: `/files/${i}`, code: error.problem });
      }
    }
    if (errors.length) throw new ProblemException(415, 'unsupported-media-type', 'Only readable, unencrypted PDFs', errors);
    return result;
  }

  /** `null` = nothing visible. */
  private visibleScoresSql(access: AccessContext) {
    if (access.has('score.view') || access.has('sheet.approve')) return sql`true`;
    const ids = access.memberEnsembleIds();
    if (!ids.length) return null;
    return sql`${scores.id} in ${this.me.visibleScoreIdsSql(ids)}`;
  }
}
