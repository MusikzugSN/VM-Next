import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, inArray, like, or, sql, type SQL } from 'drizzle-orm';
import type { CursorKey } from '../common/pagination/cursor';
import { afterNameAndId } from '../common/pagination/keyset';
import { likePattern } from '../common/sql';
import { DATABASE, type Database } from '../db/database';
import { isUniqueViolation } from '../db/db-errors';
import { instruments, scores, sheets, uploads, voices } from '../db/schema';
import { MeRepository } from '../me/me.repository';

export type ScoreVisibility = 'all' | readonly string[];

export interface NewUpload {
  id: string;
  uploadedBy: string;
  fileName: string;
  fileKey: string;
  pageCount: number;
  sizeBytes: number;
  scoreId: string | null;
  voiceId: string | null;
}

export interface AutoApprovedSheet {
  id: string;
  scoreId: string;
  voiceId: string;
  fileKey: string;
}

@Injectable()
export class UploadsRepository {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(MeRepository) private readonly me: MeRepository,
  ) {}

  async voiceCandidates() {
    return this.db
      .select({ id: voices.id, name: voices.name, instrumentId: voices.instrumentId })
      .from(voices)
      .innerJoin(instruments, eq(instruments.id, voices.instrumentId))
      .orderBy(asc(instruments.position), asc(voices.position));
  }

  async searchScores(visibility: ScoreVisibility, q: string, cursor: CursorKey | undefined, limit: number) {
    const pattern = likePattern(q);
    return this.db
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
          or(like(scores.title, pattern), like(scores.composer, pattern), like(scores.arranger, pattern)),
          this.visibleScores(visibility),
          afterNameAndId(scores.title, scores.id, cursor),
        ),
      )
      .orderBy(sql`lower(${scores.title})`, asc(scores.id))
      .limit(limit);
  }

  async countVisibleScores(visibility: ScoreVisibility, scoreIds: readonly string[]): Promise<number> {
    const rows = await this.db
      .select({ id: scores.id })
      .from(scores)
      .where(and(inArray(scores.id, [...scoreIds]), this.visibleScores(visibility)));
    return rows.length;
  }

  async countVoices(voiceIds: readonly string[]): Promise<number> {
    const rows = await this.db.select({ id: voices.id }).from(voices).where(inArray(voices.id, [...voiceIds]));
    return rows.length;
  }

  async insertPending(upload: NewUpload): Promise<void> {
    await this.db.insert(uploads).values({ ...upload, createdAt: new Date() });
  }

  async insertAutoApproved(upload: NewUpload, sheet: AutoApprovedSheet): Promise<boolean> {
    const approved = await this.db
      .transaction(async (tx) => {
        const now = new Date();
        await tx.insert(uploads).values({ ...upload, createdAt: now });
        const [existing] = await tx
          .select({ id: sheets.id })
          .from(sheets)
          .where(and(eq(sheets.scoreId, sheet.scoreId), eq(sheets.voiceId, sheet.voiceId)));
        if (existing) return false;
        await tx.insert(sheets).values({
          ...sheet,
          pageCount: upload.pageCount,
          sizeBytes: upload.sizeBytes,
          uploadId: upload.id,
          approvedBy: upload.uploadedBy,
          approvedAt: now,
        });
        await tx.update(uploads).set({ status: 'approved', decidedBy: upload.uploadedBy, decidedAt: now }).where(eq(uploads.id, upload.id));
        return true;
      })
      .catch((error: unknown) => {
        if (isUniqueViolation(error)) return null;
        throw error;
      });
    if (approved === null) {
      await this.insertPending(upload);
      return false;
    }
    return approved;
  }

  private visibleScores(visibility: ScoreVisibility): SQL {
    if (visibility === 'all') return sql`true`;
    return sql`${scores.id} in ${this.me.visibleScoreIdsSql(visibility)}`;
  }
}
