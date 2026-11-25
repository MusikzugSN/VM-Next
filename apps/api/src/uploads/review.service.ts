import { Inject, Injectable, Logger } from '@nestjs/common';
import type {
  ApproveUploadBody,
  ApproveUploadResponse,
  CursorQuery,
  RejectUploadResponse,
  ReviewQueueResponse,
  UploadDetailsResponse,
} from '@vm-web/shared';
import type { Readable } from 'node:stream';
import type { AccessContext } from '../access/access-context';
import { uuidv7 } from '../common/ids/uuid-v7';
import { decodeCursor, encodeCursor } from '../common/pagination/cursor';
import { ProblemException } from '../common/problem-details/problem.exception';
import { FILE_STORAGE, type IFileStorage } from '../storage/file-storage';
import { readOrNotFound } from '../storage/read-or-not-found';
import { streamToBuffer } from '../storage/stream-utils';
import { buildSheetPdf } from './pdf-tools';
import { ReviewRepository, type ApproveOutcome, type UploadState } from './review.repository';
import { sheetKey } from './uploads.service';

@Injectable()
export class ReviewService {
  private readonly logger = new Logger('Review');

  constructor(
    @Inject(ReviewRepository) private readonly repo: ReviewRepository,
    @Inject(FILE_STORAGE) private readonly storage: IFileStorage,
  ) {}

  async queue(query: CursorQuery): Promise<ReviewQueueResponse> {
    const { rows, total } = await this.repo.queue(decodeCursor(query.cursor, 2), query.limit + 1);
    const page = rows.slice(0, query.limit);
    const last = page.at(-1);
    return {
      items: page.map(({ createdAt, ...r }) => ({ ...r, uploadedAt: createdAt.toISOString() })),
      nextCursor: rows.length > query.limit && last ? encodeCursor([last.createdAt.toISOString(), last.uploadId]) : null,
      totalPending: total,
    };
  }

  async details(uploadId: string): Promise<UploadDetailsResponse> {
    const row = await this.repo.details(uploadId);
    if (!row) throw ProblemException.notFound();
    const { createdAt, ...rest } = row;
    const [previousUploadId, nextUploadId] = await Promise.all([this.repo.neighbour(uploadId, 'previous'), this.repo.neighbour(uploadId, 'next')]);
    return { ...rest, uploadedAt: createdAt.toISOString(), previousUploadId, nextUploadId };
  }

  async originalFile(uploadId: string): Promise<{ stream: Readable; fileName: string }> {
    const row = await this.repo.upload(uploadId);
    if (!row?.fileKey) throw ProblemException.notFound();
    const fileKey = row.fileKey;
    const stream = await readOrNotFound(this.storage, fileKey, this.logger, `Original ${fileKey} of upload ${uploadId} is missing in storage`);
    return { stream, fileName: row.fileName };
  }

  async approve(access: AccessContext, uploadId: string, body: ApproveUploadBody): Promise<ApproveUploadResponse> {
    const upload = await this.repo.upload(uploadId);
    if (!upload) throw ProblemException.notFound();
    if (upload.status !== 'pending') throw uploadStateProblem('not-pending');
    const tooFar = body.pages.flatMap((p, i) => (p.sourcePage > upload.pageCount ? [{ path: `/body/pages/${i}/sourcePage`, code: 'too_big' }] : []));
    if (tooFar.length) throw ProblemException.validation(tooFar);
    await this.assertTargets(body.scoreId, body.voiceId);
    if (!upload.fileKey) throw ProblemException.notFound('Original file is gone');

    const original = await streamToBuffer(await this.storage.read(upload.fileKey));
    const pdf = await buildSheetPdf(original, body.pages);
    const newFileKey = sheetKey(uuidv7());
    await this.storage.write(newFileKey, Buffer.from(pdf.bytes));

    let outcome: ApproveOutcome;
    try {
      outcome = await this.repo.approve({
        uploadId,
        scoreId: body.scoreId,
        voiceId: body.voiceId,
        fileKey: newFileKey,
        pageCount: pdf.pageCount,
        sizeBytes: pdf.bytes.length,
        approvedBy: access.userId,
        replaceExisting: !!body.replaceExisting,
        mayReplace: access.has('score.delete'),
      });
    } catch (error) {
      await this.storage.delete(newFileKey).catch(() => undefined);
      throw error;
    }
    if (outcome.kind !== 'approved') {
      await this.storage.delete(newFileKey).catch(() => undefined);
      throw approveProblem(outcome.kind);
    }
    if (outcome.replacedFileKey) await this.storage.delete(outcome.replacedFileKey).catch(() => undefined);
    return { sheetId: outcome.sheetId, nextUploadId: await this.repo.neighbour(uploadId, 'next') };
  }

  async reject(userId: string, uploadId: string, reason: string): Promise<RejectUploadResponse> {
    const state = await this.repo.reject(uploadId, userId, reason);
    if (state) throw uploadStateProblem(state);
    return { nextUploadId: await this.repo.neighbour(uploadId, 'next') };
  }

  private async assertTargets(scoreId: string, voiceId: string): Promise<void> {
    const exists = await this.repo.targetsExist(scoreId, voiceId);
    if (!exists.score) throw ProblemException.notFound('Unknown score');
    if (!exists.voice) throw ProblemException.notFound('Unknown voice');
  }
}

function uploadStateProblem(state: UploadState): ProblemException {
  return state === 'not-found' ? ProblemException.notFound() : ProblemException.conflict('upload-not-pending');
}

function approveProblem(kind: Exclude<ApproveOutcome['kind'], 'approved'>): ProblemException {
  if (kind === 'sheet-exists') return ProblemException.conflict('sheet-exists');
  if (kind === 'replace-forbidden') return ProblemException.forbidden('Replacing a sheet needs score.delete');
  return uploadStateProblem(kind);
}
