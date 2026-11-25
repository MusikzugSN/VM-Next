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
import { readFile, rm } from 'node:fs/promises';
import type { AccessContext } from '../access/access-context';
import { uploadTempPath } from '../common/files/upload-temp';
import { uuidv7 } from '../common/ids/uuid-v7';
import { decodeCursor, toPage } from '../common/pagination/cursor';
import { ProblemException } from '../common/problem-details/problem.exception';
import { toJsonPointer } from '../common/validation/zod-validation.pipe';
import { FILE_STORAGE, type IFileStorage } from '../storage/file-storage';
import { InvalidPdfError, inspectPdf } from './pdf-tools';
import { UploadsRepository, type ScoreVisibility } from './uploads.repository';
import { suggestVoice } from './voice-suggestion';

export interface UploadedFileInfo {
  originalname: string;
  path: string;
  size: number;
}

export const uploadKey = (id: string) => `uploads/${id}.pdf`;
export const sheetKey = (id: string) => `sheets/${id}.pdf`;

@Injectable()
export class UploadsService {
  constructor(
    @Inject(UploadsRepository) private readonly repo: UploadsRepository,
    @Inject(FILE_STORAGE) private readonly storage: IFileStorage,
  ) {}

  async voiceSuggestions(fileNames: readonly string[]): Promise<VoiceSuggestionsResponse> {
    const candidates = await this.repo.voiceCandidates();
    return {
      items: fileNames.map((fileName) => {
        const match = suggestVoice(fileName, candidates);
        return { fileName, voice: match ? (candidates.find((c) => c.id === match.id) ?? null) : null };
      }),
    };
  }

  async scoreSearch(access: AccessContext, query: ScoreSearchQuery): Promise<Page<ScoreSearchItem>> {
    const visibility = scoreVisibility(access);
    if (visibility === null) return { items: [], nextCursor: null };
    const rows = await this.repo.searchScores(visibility, query.q, decodeCursor(query.cursor, 2), query.limit + 1);
    return toPage(rows, query.limit, (r) => [r.sortKey, r.id], (r) => ({ id: r.id, title: r.title, composer: r.composer, arranger: r.arranger }));
  }

  async upload(access: AccessContext, filesRaw: readonly UploadedFileInfo[], metaRaw: unknown): Promise<UploadSheetsResponse> {
    const files: readonly UploadedFileInfo[] = Array.isArray(filesRaw) ? filesRaw : [];
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
      await Promise.all(files.map(async (f) => rm(uploadTempPath(f.path), { force: true })));
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
      const upload = {
        id: uploadId,
        uploadedBy: userId,
        fileName: item.fileName,
        fileKey: uploadKey(uploadId),
        pageCount,
        sizeBytes: bytes.length,
        scoreId: item.scoreId,
        voiceId: item.voiceId,
      };
      if (!canApprove || !item.scoreId || !item.voiceId) {
        await this.repo.insertPending(upload);
        return { uploadId, fileName: item.fileName, status: 'pending', sheetId: null, pageCount };
      }
      const sheetId = uuidv7();
      await this.storage.write(sheetKey(sheetId), bytes);
      written.push(sheetKey(sheetId));
      const approved = await this.repo.insertAutoApproved(upload, { id: sheetId, scoreId: item.scoreId, voiceId: item.voiceId, fileKey: sheetKey(sheetId) });
      if (!approved) await this.storage.delete(sheetKey(sheetId));
      return { uploadId, fileName: item.fileName, status: approved ? 'approved' : 'pending', sheetId: approved ? sheetId : null, pageCount };
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

  private async checkTargets(access: AccessContext, items: readonly { scoreId: string | null; voiceId: string | null }[]): Promise<void> {
    const scoreIds = [...new Set(items.map((i) => i.scoreId).filter((id): id is string => !!id))];
    const voiceIds = [...new Set(items.map((i) => i.voiceId).filter((id): id is string => !!id))];
    if (scoreIds.length) {
      const visibility = scoreVisibility(access);
      const found = visibility === null ? 0 : await this.repo.countVisibleScores(visibility, scoreIds);
      if (found !== scoreIds.length) throw ProblemException.notFound('Unknown score');
    }
    if (voiceIds.length && (await this.repo.countVoices(voiceIds)) !== voiceIds.length) throw ProblemException.notFound('Unknown voice');
  }

  private async readPdfs(files: readonly UploadedFileInfo[]): Promise<{ bytes: Buffer; pageCount: number }[]> {
    const errors: ValidationError[] = [];
    const result: { bytes: Buffer; pageCount: number }[] = [];
    for (const [i, file] of files.entries()) {
      const bytes = await readFile(uploadTempPath(file.path));
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
}

function scoreVisibility(access: AccessContext): ScoreVisibility | null {
  if (access.has('score.view') || access.has('sheet.approve')) return 'all';
  const ids = access.memberEnsembleIds();
  return ids.length ? ids : null;
}
