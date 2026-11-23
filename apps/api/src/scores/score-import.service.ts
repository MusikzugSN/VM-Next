import { Inject, Injectable } from '@nestjs/common';
import {
  SCORE_IMPORT_NEW_FIELD_PREFIX,
  type ScoreImportAction,
  type ScoreImportBody,
  type ScoreImportIssue,
  type ScoreImportResponse,
  type ScoreImportResultRow,
  type ScoreImportRow,
  type ValidationError,
} from '@vm-web/shared';
import { eq, inArray } from 'drizzle-orm';
import type { AccessContext } from '../access/access-context';
import { uuidv7 } from '../common/ids/uuid-v7';
import { naturalSortKey } from '../common/natural-sort';
import { ProblemException } from '../common/problem-details/problem.exception';
import { fieldDefinitions, fieldOptions, folderEntries, folders, scores } from '../db/schema';
import { assertActiveEnsemble } from '../library/library-helpers';
import type { FieldDef } from './custom-fields';
import { matchKey, parseDuration, parseLabels, parseScalar, parseText, type Parsed } from './score-import-values';
import { ScoresRepository } from './scores.repository';
import { nextPosition } from '../db/table-helpers';

const FOLDER_NUMBER_MAX = 10;
const INSERT_CHUNK = 500;

type Fixed = {
  title: string;
  composer: string | null;
  arranger: string | null;
  publisher: string | null;
  publisherNumber: string | null;
  durationSeconds: number | null;
};
const FIXED_KEYS = ['composer', 'arranger', 'publisher', 'publisherNumber', 'durationSeconds'] as const;

/** A score as it will be after the import; `isNew` scores are inserted, `changed` ones updated. */
interface ScoreState {
  id: string;
  fixed: Fixed;
  custom: Record<string, unknown>;
  isNew: boolean;
  changed: boolean;
}

interface FieldPlan extends FieldDef {
  isNew: boolean;
  /** Issue target: `field:<id>` or `new:<key>`. */
  target: string;
  /** Options added by this import (lower-case label → id). */
  added: Map<string, string>;
  /** All options, lower-case label → id. */
  byLabel: Map<string, string>;
}

interface FolderPlan {
  id: string;
  ensembleId: string;
  name: string;
  isNew: boolean;
  touched: boolean;
  /** scoreId → number */
  entries: Map<string, string>;
  /** number → scoreId */
  numbers: Map<string, string>;
  added: { scoreId: string; number: string }[];
}

/**
 * CSV import of scores (N-19): the client maps columns and sends raw cell values; values are converted
 * here, rows are matched against existing scores (title, plus composer when both are set) and against
 * earlier rows of the same file, and everything is written in one transaction.
 */
@Injectable()
export class ScoreImportService {
  constructor(@Inject(ScoresRepository) private readonly repo: ScoresRepository) {}

  async run(body: ScoreImportBody, access: AccessContext): Promise<ScoreImportResponse> {
    if (!access.has('score.create') || !access.has('score.edit')) throw ProblemException.forbidden();

    const fields = await this.fieldPlans(body);
    this.checkCustomKeys(body.rows, fields);
    const folderPlans = await this.folderPlans(body, access);
    const index = await this.scoreIndex();
    const states = new Map<string, ScoreState>();
    const inFile = new Set<string>();

    const rows: ScoreImportResultRow[] = [];
    for (const row of body.rows) {
      rows.push(this.planRow(row, fields, folderPlans, index, states, inFile));
    }

    if (!body.dryRun) await this.write(fields, folderPlans, states);

    const ok = rows.filter((r) => !r.failed);
    return {
      dryRun: body.dryRun,
      rows: body.dryRun ? rows.map((r) => ({ ...r, scoreId: null })) : rows,
      summary: {
        create: ok.filter((r) => r.action === 'create').length,
        link: ok.filter((r) => r.action === 'link').length,
        overwrite: ok.filter((r) => r.action === 'overwrite').length,
        skip: ok.filter((r) => r.action === 'skip').length,
        failed: rows.length - ok.length,
        newFolders: [...folderPlans.values()].filter((f) => f.isNew && f.touched).map((f) => f.name),
        newOptions: [...fields.values()].reduce((n, f) => n + f.added.size, 0),
      },
    };
  }

  // --- planning ------------------------------------------------------------------------------------------------

  private planRow(
    row: ScoreImportRow,
    fields: Map<string, FieldPlan>,
    folderPlans: Map<string, FolderPlan>,
    index: Map<string, ScoreState[]>,
    states: Map<string, ScoreState>,
    inFile: Set<string>,
  ): ScoreImportResultRow {
    const issues: ScoreImportIssue[] = [];
    const error = (target: string, code: string) => issues.push({ target, code, level: 'error' });
    const warn = (target: string, code: string) => issues.push({ target, code, level: 'warning' });

    // fixed fields (N-1)
    const text = (key: keyof Fixed, max: number) => take(parseText(row.fixed[key as 'title'], max), key, error);
    const fixed: Fixed = {
      title: text('title', 200) ?? '',
      composer: text('composer', 200),
      arranger: text('arranger', 200),
      publisher: text('publisher', 200),
      publisherNumber: text('publisherNumber', 100),
      durationSeconds: take(parseDuration(row.fixed.duration), 'duration', error),
    };
    if (!fixed.title && !issues.some((i) => i.target === 'title')) error('title', 'required');

    // custom fields (N-2): option labels are resolved later, only when the row is imported
    const custom: Record<string, unknown> = {};
    const labels = new Map<FieldPlan, string[]>();
    for (const [key, raw] of Object.entries(row.custom)) {
      const field = fields.get(key);
      if (!field) continue;
      if (field.type === 'select' || field.type === 'multiselect') {
        const found = parseLabels(raw, field.type === 'multiselect');
        if (found.length) labels.set(field, found);
      } else {
        const value = take(parseScalar(field.type, raw), field.target, error);
        if (value !== null) custom[field.id] = value;
      }
    }

    // match (N-19): existing score or an earlier row of this file
    const candidates = (index.get(matchKey(fixed.title)) ?? []).filter(
      (s) => !fixed.composer || !s.fixed.composer || matchKey(s.fixed.composer) === matchKey(fixed.composer),
    );
    const matched = candidates[0];
    if (candidates.length > 1) warn('title', 'ambiguous');
    let action: ScoreImportAction = row.action ?? (matched ? 'link' : 'create');
    if (!matched && (action === 'link' || action === 'overwrite')) action = 'create';
    if (action === 'create') {
      for (const field of fields.values()) {
        if (field.required && custom[field.id] === undefined && !labels.has(field)) error(field.target, 'required');
      }
    }

    const failed = issues.some((i) => i.level === 'error');
    const result: ScoreImportResultRow = {
      line: row.line,
      title: fixed.title || (row.fixed.title ?? '').trim(),
      action,
      failed,
      match: matched ? { id: matched.id, title: matched.fixed.title, composer: matched.fixed.composer, inFile: inFile.has(matched.id) } : null,
      folder: null,
      issues,
      scoreId: null,
    };
    if (failed || action === 'skip') return result;

    for (const [field, found] of labels) custom[field.id] = this.optionIds(field, found);

    // apply to the planned state
    let state: ScoreState;
    if (action === 'create' || !matched) {
      state = { id: uuidv7(), fixed, custom, isNew: true, changed: true };
      states.set(state.id, state);
      inFile.add(state.id);
      const key = matchKey(fixed.title);
      index.set(key, [...(index.get(key) ?? []), state]);
    } else {
      state = states.get(matched.id) ?? matched;
      states.set(state.id, state);
      const onlyEmpty = action === 'link';
      for (const key of FIXED_KEYS) {
        const value = fixed[key];
        if (value === null || (onlyEmpty && state.fixed[key] !== null) || state.fixed[key] === value) continue;
        (state.fixed as Record<string, unknown>)[key] = value;
        state.changed = true;
      }
      if (!onlyEmpty && fixed.title !== state.fixed.title) {
        state.fixed.title = fixed.title;
        state.changed = true;
      }
      for (const [id, value] of Object.entries(custom)) {
        if (onlyEmpty && state.custom[id] !== undefined) continue;
        if (JSON.stringify(state.custom[id]) === JSON.stringify(value)) continue;
        state.custom[id] = value;
        state.changed = true;
      }
    }
    result.scoreId = state.id;

    // folder entry (N-5)
    const folder = folderPlans.get(matchKey(row.folder?.name ?? ''));
    if (folder) {
      const number = (row.folder?.number ?? '').trim();
      result.folder = { name: folder.name, number, isNew: folder.isNew };
      const existing = folder.entries.get(state.id);
      if (existing !== undefined) {
        if (existing !== number) warn('folder', 'folder-other-number');
      } else if (!number) {
        warn('folder', 'folder-number-missing');
      } else if (number.length > FOLDER_NUMBER_MAX) {
        warn('folder', 'folder-number-invalid');
      } else if (folder.numbers.has(number)) {
        warn('folder', 'folder-number-taken');
      } else {
        folder.entries.set(state.id, number);
        folder.numbers.set(number, state.id);
        folder.added.push({ scoreId: state.id, number });
        folder.touched = true;
      }
    }
    return result;
  }

  /** Option ids for labels; unknown labels become new options of the field. */
  private optionIds(field: FieldPlan, labels: string[]): string | string[] {
    const ids = labels.map((label) => {
      const key = label.toLowerCase();
      let id = field.byLabel.get(key);
      if (!id) {
        id = uuidv7();
        field.byLabel.set(key, id);
        field.added.set(key, id);
        field.options.push({ id, label });
      }
      return id;
    });
    return field.type === 'multiselect' ? ids : ids[0];
  }

  private async fieldPlans(body: ScoreImportBody): Promise<Map<string, FieldPlan>> {
    const existing = await this.repo.fields();
    const plans = new Map<string, FieldPlan>();
    const plan = (def: FieldDef, target: string | null): FieldPlan => ({
      ...def,
      options: [...def.options],
      isNew: target !== null,
      target: target ?? `field:${def.id}`,
      added: new Map(),
      byLabel: new Map(def.options.map((o) => [o.label.toLowerCase(), o.id])),
    });
    for (const def of existing) plans.set(def.id, plan(def, null));

    const names = new Set(existing.map((f) => f.name.toLowerCase()));
    const keys = new Set<string>();
    const errors: ValidationError[] = [];
    for (const [i, field] of body.newFields.entries()) {
      if (keys.has(field.key)) errors.push({ path: `/body/newFields/${i}/key`, code: 'duplicate' });
      if (names.has(field.name.toLowerCase())) throw ProblemException.conflict('name-taken');
      keys.add(field.key);
      names.add(field.name.toLowerCase());
      const key = SCORE_IMPORT_NEW_FIELD_PREFIX + field.key;
      plans.set(key, plan({ id: uuidv7(), name: field.name, type: field.type, required: false, options: [] }, key));
    }
    if (errors.length) throw ProblemException.validation(errors);
    return plans;
  }

  private checkCustomKeys(rows: readonly ScoreImportRow[], fields: Map<string, FieldPlan>): void {
    const errors: ValidationError[] = [];
    for (const [i, row] of rows.entries()) {
      for (const key of Object.keys(row.custom)) {
        if (!fields.has(key)) errors.push({ path: `/body/rows/${i}/custom/${key}`, code: 'unknown_field' });
      }
      if (errors.length >= 20) break;
    }
    if (errors.length) throw ProblemException.validation(errors);
  }

  /** Folders by lower-case name in the chosen ensemble; missing ones are planned as new (N-19). */
  private async folderPlans(body: ScoreImportBody, access: AccessContext): Promise<Map<string, FolderPlan>> {
    const plans = new Map<string, FolderPlan>();
    const wanted = new Map<string, string>();
    for (const row of body.rows) {
      const name = (row.folder?.name ?? '').trim();
      if (name && row.action !== 'skip' && !wanted.has(matchKey(name))) wanted.set(matchKey(name), name.slice(0, 100));
    }
    if (!wanted.size) return plans;

    const ensembleId = body.folderEnsembleId;
    if (!ensembleId) throw ProblemException.validation([{ path: '/body/folderEnsembleId', code: 'required' }]);
    if (!access.has('folder.view', ensembleId)) throw ProblemException.notFound('Unknown ensemble');
    if (!access.has('folder.edit', ensembleId)) throw ProblemException.forbidden();
    await assertActiveEnsemble(this.repo.db, ensembleId);

    const rows = await this.repo.db.select({ id: folders.id, name: folders.name }).from(folders).where(eq(folders.ensembleId, ensembleId));
    const existing = new Map(rows.map((r) => [matchKey(r.name), r]));
    const ids = [...wanted.keys()].map((k) => existing.get(k)?.id).filter((id): id is string => !!id);
    const entries = ids.length
      ? await this.repo.db
          .select({ folderId: folderEntries.folderId, scoreId: folderEntries.scoreId, number: folderEntries.number })
          .from(folderEntries)
          .where(inArray(folderEntries.folderId, ids))
      : [];

    for (const [key, name] of wanted) {
      const found = existing.get(key);
      const own = entries.filter((e) => e.folderId === found?.id);
      plans.set(key, {
        id: found?.id ?? uuidv7(),
        ensembleId,
        name: found?.name ?? name,
        isNew: !found,
        touched: false,
        entries: new Map(own.map((e) => [e.scoreId, e.number])),
        numbers: new Map(own.map((e) => [e.number, e.scoreId])),
        added: [],
      });
    }
    if ([...plans.values()].some((f) => f.isNew) && !access.has('folder.create', ensembleId)) throw ProblemException.forbidden();
    return plans;
  }

  /** All scores by match key of the title, oldest first. */
  private async scoreIndex(): Promise<Map<string, ScoreState[]>> {
    const rows = await this.repo.db.select().from(scores).orderBy(scores.createdAt, scores.id);
    const index = new Map<string, ScoreState[]>();
    for (const row of rows) {
      const state: ScoreState = {
        id: row.id,
        fixed: {
          title: row.title,
          composer: row.composer,
          arranger: row.arranger,
          publisher: row.publisher,
          publisherNumber: row.publisherNumber,
          durationSeconds: row.durationSeconds,
        },
        custom: { ...row.customValues },
        isNew: false,
        changed: false,
      };
      const key = matchKey(row.title);
      index.set(key, [...(index.get(key) ?? []), state]);
    }
    return index;
  }

  // --- writing -------------------------------------------------------------------------------------------------

  private async write(fields: Map<string, FieldPlan>, folderPlans: Map<string, FolderPlan>, states: Map<string, ScoreState>): Promise<void> {
    await this.repo.db.transaction(async (tx) => {
      // new fields and options (N-2)
      let position = await nextPosition(tx, fieldDefinitions.position);
      for (const field of fields.values()) {
        if (field.isNew) await tx.insert(fieldDefinitions).values({ id: field.id, name: field.name, type: field.type, required: false, position: position++ });
        if (!field.added.size) continue;
        const addedIds = new Set(field.added.values());
        const values = field.options
          .map((o, i) => ({ id: o.id, fieldId: field.id, label: o.label, position: i }))
          .filter((o) => addedIds.has(o.id));
        if (!field.isNew) {
          const first = await nextPosition(tx, fieldOptions.position, eq(fieldOptions.fieldId, field.id));
          values.forEach((v, i) => (v.position = first + i));
        }
        await tx.insert(fieldOptions).values(values);
      }

      // folders, scores, entries (N-5)
      const newFolders = [...folderPlans.values()].filter((f) => f.isNew && f.touched);
      for (const folder of newFolders) await tx.insert(folders).values({ id: folder.id, ensembleId: folder.ensembleId, name: folder.name });

      const created = [...states.values()].filter((s) => s.isNew);
      for (let i = 0; i < created.length; i += INSERT_CHUNK) {
        await tx.insert(scores).values(created.slice(i, i + INSERT_CHUNK).map((s) => ({ id: s.id, ...s.fixed, customValues: s.custom })));
      }
      for (const state of states.values()) {
        if (state.isNew || !state.changed) continue;
        await tx
          .update(scores)
          .set({ ...state.fixed, customValues: state.custom, updatedAt: new Date() })
          .where(eq(scores.id, state.id));
      }

      for (const folder of folderPlans.values()) {
        if (!folder.added.length) continue;
        for (let i = 0; i < folder.added.length; i += INSERT_CHUNK) {
          await tx.insert(folderEntries).values(
            folder.added.slice(i, i + INSERT_CHUNK).map((e) => ({ folderId: folder.id, scoreId: e.scoreId, number: e.number, numberSortKey: naturalSortKey(e.number) })),
          );
        }
        await tx.update(folders).set({ updatedAt: new Date() }).where(eq(folders.id, folder.id));
      }
    });
  }

}

/** Value of a parse result; reports the issue code as error. */
function take<T>(result: Parsed<T>, target: string, error: (target: string, code: string) => void): T | null {
  if (result.code) {
    error(target, result.code);
    return null;
  }
  return result.value ?? null;
}
