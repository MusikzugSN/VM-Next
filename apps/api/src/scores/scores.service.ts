import { Inject, Injectable, Logger } from '@nestjs/common';
import type {
  CreateScoreBody,
  ScoreCompletenessResponse,
  ScoreDetailsResponse,
  ScoreEnsembleOptionsResponse,
  ScoreFoldersResponse,
  ScoreSheetsResponse,
  ScoreTableExportQuery,
  ScoreTableQuery,
  ScoreTableResponse,
  ScoreTableRow,
  UpdateScoreDetailsBody,
  VoiceRef,
} from '@vm-web/shared';
import { sql, type SQL } from 'drizzle-orm';
import type { Readable } from 'node:stream';
import type { AccessContext } from '../access/access-context';
import { CSV_BOM, csvLine } from '../common/files/csv';
import { sheetFileName } from '../common/files/download-names';
import { uuidv7 } from '../common/ids/uuid-v7';
import { decodeCursor, encodeCursor } from '../common/pagination/cursor';
import { ProblemException } from '../common/problem-details/problem.exception';
import { scores } from '../db/schema';
import { MeRepository } from '../me/me.repository';
import { ClubSettingsRepository } from '../settings/club-settings.repository';
import { FILE_STORAGE, type IFileStorage } from '../storage/file-storage';
import { completenessOf } from './completeness';
import { displayValue, validateCustomValues, type FieldDef } from './custom-fields';
import { afterCursor, buildFilters, buildSort, searchSql } from './score-query';
import { ScoresRepository, type ScoreRow } from './scores.repository';

const EXPORT_MAX_ROWS = 10_000;

/** Library: score table, details, completeness, sheets (N-1..N-5, N-9). */
@Injectable()
export class ScoresService {
  private readonly logger = new Logger('Scores');

  constructor(
    @Inject(ScoresRepository) private readonly repo: ScoresRepository,
    @Inject(MeRepository) private readonly voices: MeRepository,
    @Inject(ClubSettingsRepository) private readonly settings: ClubSettingsRepository,
    @Inject(FILE_STORAGE) private readonly storage: IFileStorage,
  ) {}

  // --- table (N-1, N-3, N-4) ----------------------------------------------------------------------------------

  async table(query: ScoreTableQuery): Promise<ScoreTableResponse> {
    const fields = await this.repo.fields();
    const ensemble = await this.completenessEnsemble(query.ensembleId);
    const { where, plan } = this.plan(query, fields, ensemble?.id ?? null);
    const cursor = decodeCursor(query.cursor, 3);

    const [rows, totalCount] = await Promise.all([
      this.repo.scoreTable(cursor ? [...where, afterCursor(plan, cursor)] : where, plan, query.limit + 1),
      this.repo.countScores(where),
    ]);
    const page = rows.slice(0, query.limit);
    const items = await this.tableRows(page.map((r) => r.score), ensemble?.id ?? null);
    const last = page.at(-1);
    return {
      items,
      nextCursor: rows.length > query.limit && last ? encodeCursor([last.sortEmpty, cursorValue(last.sortValue), last.score.id]) : null,
      completenessEnsemble: ensemble ?? null,
      totalCount,
    };
  }

  /** CSV export with the same filters (N-3, F-10): fixed fields, custom fields, tags, completeness. */
  async export(query: ScoreTableExportQuery): Promise<string> {
    const fields = await this.repo.fields();
    const ensemble = await this.completenessEnsemble(query.ensembleId);
    const { where, plan } = this.plan(query, fields, ensemble?.id ?? null);
    const rows = await this.repo.scoreTable(where, plan, EXPORT_MAX_ROWS);
    const items = await this.tableRows(rows.map((r) => r.score), ensemble?.id ?? null);

    const header = ['title', 'composer', 'arranger', 'publisher', 'publisherNumber', 'durationSeconds', ...fields.map((f) => f.name), 'tags', 'completeness'];
    let csv = CSV_BOM + csvLine(header);
    for (const row of items) {
      csv += csvLine([
        row.title,
        row.composer,
        row.arranger,
        row.publisher,
        row.publisherNumber,
        row.durationSeconds,
        ...fields.map((f) => displayValue(f, row.customFields[f.id])),
        row.tags.map((t) => t.name).join(', '),
        ensemble ? `${row.completeness.present}/${row.completeness.total}` : '',
      ]);
    }
    return csv;
  }

  // --- details (N-1, N-2, N-17) -------------------------------------------------------------------------------

  async details(scoreId: string): Promise<ScoreDetailsResponse> {
    const score = await this.repo.score(scoreId);
    if (!score) throw ProblemException.notFound();
    const tags = await this.repo.tagsOf([scoreId]);
    return {
      ...fixedOf(score),
      id: score.id,
      customFields: score.customValues as ScoreDetailsResponse['customFields'],
      tags: tags.get(scoreId) ?? [],
      createdAt: score.createdAt.toISOString(),
      updatedAt: score.updatedAt.toISOString(),
    };
  }

  async create(body: CreateScoreBody): Promise<{ id: string }> {
    const { customValues, tagIds } = await this.validate(body);
    const id = uuidv7();
    await this.repo.insertScore(id, fixedOf(body), customValues, tagIds);
    return { id };
  }

  async update(scoreId: string, body: UpdateScoreDetailsBody): Promise<void> {
    await this.requireScore(scoreId);
    const { customValues, tagIds } = await this.validate(body);
    await this.repo.updateScore(scoreId, fixedOf(body), customValues, tagIds);
  }

  async delete(scoreId: string): Promise<void> {
    await this.requireScore(scoreId);
    const files = await this.repo.deleteScore(scoreId);
    await this.removeFiles(files);
  }

  // --- completeness, sheets, folders (N-4, N-5, N-9) ----------------------------------------------------------

  async completeness(scoreId: string, ensembleId: string | undefined): Promise<ScoreCompletenessResponse> {
    await this.requireScore(scoreId);
    const ensemble = await this.completenessEnsemble(ensembleId);
    if (!ensemble) return { ensemble: null, summary: { present: 0, substituted: 0, total: 0 }, voices: [] };
    const { lineup, substitutesOf, voiceIds } = await this.lineupWithSubstitutes(ensemble.id);
    const sheets = await this.repo.sheetIdsByVoice([scoreId], voiceIds);
    const result = completenessOf(lineup, substitutesOf, sheets.get(scoreId) ?? new Map());
    return { ensemble, summary: result.summary, voices: result.voices };
  }

  async sheets(scoreId: string): Promise<ScoreSheetsResponse> {
    await this.requireScore(scoreId);
    const [rows, pendingUploadCount] = await Promise.all([this.repo.sheetsOfScore(scoreId), this.repo.pendingUploadCount(scoreId)]);
    return {
      items: rows.map((r) => ({
        sheetId: r.sheetId,
        voice: r.voice,
        pageCount: r.pageCount,
        approvedAt: r.approvedAt.toISOString(),
        uploadedBy: r.uploadedBy,
      })),
      pendingUploadCount,
    };
  }

  async folders(scoreId: string, access: AccessContext): Promise<ScoreFoldersResponse> {
    await this.requireScore(scoreId);
    const ensembleIds = access.isAdmin ? 'all' : access.ensemblesWith('folder.view');
    return { items: await this.repo.foldersOfScore(scoreId, ensembleIds) };
  }

  private async requireScore(scoreId: string): Promise<void> {
    if (!(await this.repo.score(scoreId))) throw ProblemException.notFound();
  }

  async sheetFile(sheetId: string): Promise<{ stream: Readable; fileName: string }> {
    const sheet = await this.repo.sheet(sheetId);
    if (!sheet) throw ProblemException.notFound();
    const stream = await this.storage.read(sheet.fileKey).catch(() => {
      this.logger.error(`File ${sheet.fileKey} of sheet ${sheetId} is missing in storage`);
      throw ProblemException.notFound();
    });
    return { stream, fileName: sheetFileName({ title: sheet.title, voice: sheet.voiceName }) };
  }

  async deleteSheet(sheetId: string): Promise<void> {
    const key = await this.repo.deleteSheet(sheetId);
    if (!key) throw ProblemException.notFound();
    await this.removeFiles([key]);
  }

  // --- options --------------------------------------------------------------------------------------------------

  async ensembleOptions(): Promise<ScoreEnsembleOptionsResponse> {
    const [items, settings] = await Promise.all([this.repo.ensemblesWithLineup(), this.settings.get()]);
    return { items, defaultEnsembleId: settings.defaultEnsembleId };
  }

  async tagOptions() {
    return { items: await this.repo.allClubTags() };
  }

  // --- helpers ----------------------------------------------------------------------------------------------

  private plan(query: ScoreTableExportQuery, fields: FieldDef[], ensembleId: string | null) {
    const byId = new Map(fields.map((f) => [f.id, f]));
    const where: SQL[] = buildFilters(query.filter ?? [], byId, ensembleId);
    if (query.q) where.push(searchSql(query.q));
    if (query.tagId) where.push(sql`exists (select 1 from score_club_tags x where x.score_id = ${scores.id} and x.tag_id = ${query.tagId}::uuid)`);
    return { where, plan: buildSort(query.sort, query.dir, byId, ensembleId) };
  }

  /** The given ensemble (404 if unknown) or the configured default ensemble (F-5). */
  private async completenessEnsemble(ensembleId: string | undefined) {
    const id = ensembleId ?? (await this.settings.get()).defaultEnsembleId;
    if (!id) return undefined;
    const ensemble = await this.repo.ensembleRef(id);
    if (!ensemble && ensembleId) throw ProblemException.notFound('Unknown ensemble');
    return ensemble;
  }

  private async lineupWithSubstitutes(ensembleId: string) {
    const lineup = await this.repo.lineup(ensembleId);
    const substitutesOf = await this.voices.substitutesOf(lineup.map((v) => v.id));
    const voiceIds = new Set(lineup.map((v) => v.id));
    for (const subs of substitutesOf.values()) subs.forEach((s: VoiceRef) => voiceIds.add(s.id));
    return { lineup, substitutesOf, voiceIds: [...voiceIds] };
  }

  private async tableRows(rows: ScoreRow[], ensembleId: string | null): Promise<ScoreTableRow[]> {
    const ids = rows.map((r) => r.id);
    const [tags, lineupInfo] = await Promise.all([this.repo.tagsOf(ids), ensembleId ? this.lineupWithSubstitutes(ensembleId) : undefined]);
    const sheets = lineupInfo ? await this.repo.sheetIdsByVoice(ids, lineupInfo.voiceIds) : new Map<string, Map<string, string>>();
    return rows.map((score) => ({
      ...fixedOf(score),
      id: score.id,
      customFields: score.customValues as ScoreTableRow['customFields'],
      tags: tags.get(score.id) ?? [],
      completeness: lineupInfo
        ? completenessOf(lineupInfo.lineup, lineupInfo.substitutesOf, sheets.get(score.id) ?? new Map()).summary
        : { present: 0, substituted: 0, total: 0 },
    }));
  }

  /** Validates custom fields (N-2) and club tags (404 for unknown tags). */
  private async validate(body: CreateScoreBody | UpdateScoreDetailsBody) {
    const { values, errors } = validateCustomValues(await this.repo.fields(), body.customFields);
    if (errors.length) throw ProblemException.validation(errors);
    const tagIds = [...new Set(body.tagIds)];
    const existing = await this.repo.existingTagIds(tagIds);
    if (tagIds.some((id) => !existing.has(id))) throw ProblemException.notFound('Unknown club tag');
    return { customValues: values, tagIds };
  }

  private async removeFiles(keys: string[]): Promise<void> {
    for (const key of keys) {
      await this.storage.delete(key).catch((error: unknown) => this.logger.warn(`Could not delete ${key}: ${String(error)}`));
    }
  }
}

function fixedOf(s: CreateScoreBody | ScoreRow) {
  return {
    title: s.title,
    composer: s.composer ?? null,
    arranger: s.arranger ?? null,
    publisher: s.publisher ?? null,
    publisherNumber: s.publisherNumber ?? null,
    durationSeconds: s.durationSeconds ?? null,
  };
}

/** Numeric sort values come from postgres as strings; booleans are kept as 0/1. */
function cursorValue(value: string | number | boolean | null): string | number | null {
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return value;
}
