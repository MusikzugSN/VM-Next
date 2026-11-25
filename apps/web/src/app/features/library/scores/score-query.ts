import type { Params } from '@angular/router';
import { scoreColumnSchema, scoreFilterSchema, type FieldDefinition, type ScoreColumn, type ScoreFilter } from '@vm-web/shared';
import * as z from 'zod';

/** State of the score table, kept in the URL query (search, sort, filters survive reload and back button). */
export interface ScoreQueryState {
  q: string;
  sort: ScoreColumn;
  dir: 'asc' | 'desc';
  tagId: string | null;
  ensembleId: string | null;
  filters: ScoreFilter[];
}


const filtersSchema = z.array(scoreFilterSchema).max(20);

export function parseScoreQuery(params: Params): ScoreQueryState {
  const sort = scoreColumnSchema.safeParse(params['sort']);
  let filters: ScoreFilter[] = [];
  if (typeof params['filter'] === 'string') {
    try {
      const parsed = filtersSchema.safeParse(JSON.parse(params['filter']));
      if (parsed.success) filters = parsed.data;
    } catch {
      filters = [];
    }
  }
  return {
    q: typeof params['q'] === 'string' ? params['q'] : '',
    sort: sort.success ? sort.data : 'title',
    dir: params['dir'] === 'desc' ? 'desc' : 'asc',
    tagId: typeof params['tagId'] === 'string' ? params['tagId'] : null,
    ensembleId: typeof params['ensembleId'] === 'string' ? params['ensembleId'] : null,
    filters,
  };
}

/** Query params for the router; defaults are left out so URLs stay short. */
export function scoreQueryParams(state: ScoreQueryState): Params {
  return {
    q: state.q || null,
    sort: state.sort === 'title' ? null : state.sort,
    dir: state.dir === 'asc' ? null : state.dir,
    tagId: state.tagId,
    ensembleId: state.ensembleId,
    filter: state.filters.length ? JSON.stringify(state.filters) : null,
  };
}

/** Query of `GET scores/score-table` (and the CSV export). */
export function scoreTableQuery(state: ScoreQueryState) {
  return {
    q: state.q.trim() || undefined,
    sort: state.sort,
    dir: state.dir,
    tagId: state.tagId ?? undefined,
    ensembleId: state.ensembleId ?? undefined,
    filter: state.filters.length ? JSON.stringify(state.filters) : undefined,
  };
}

/** Number of active conditions (badge at the filter button). */
export function activeFilterCount(state: ScoreQueryState): number {
  return state.filters.length + (state.tagId ? 1 : 0);
}

// ---------------------------------------------------------------------------------------------
// Filter dialog: one input per column, converted to and from API conditions.

/** Input of one column in the filter dialog. */
export type FilterInput =
  | { kind: 'text'; contains: string }
  | { kind: 'range'; from: string; to: string }
  | { kind: 'options'; ids: string[] }
  | { kind: 'boolean'; value: '' | 'true' | 'false' };

export type FilterDraft = Record<string, FilterInput>;

/** Open bounds of a range; the API only knows closed `between`. */
const RANGE_MIN: Record<'number' | 'date', number | string> = { number: -1_000_000_000, date: '0001-01-01' };
const RANGE_MAX: Record<'number' | 'date', number | string> = { number: 1_000_000_000, date: '9999-12-31' };

export function fieldColumn(field: FieldDefinition): ScoreColumn {
  return `field:${field.id}`;
}

/** Filterable columns: composer and publisher (text) plus every custom field. */
export function filterColumns(fields: readonly FieldDefinition[]): { column: ScoreColumn; type: FieldDefinition['type'] }[] {
  return [
    { column: 'composer', type: 'text' },
    { column: 'publisher', type: 'text' },
    ...fields.map((field) => ({ column: fieldColumn(field), type: field.type })),
  ];
}

export function emptyInput(type: FieldDefinition['type']): FilterInput {
  switch (type) {
    case 'number':
    case 'date':
      return { kind: 'range', from: '', to: '' };
    case 'select':
    case 'multiselect':
      return { kind: 'options', ids: [] };
    case 'boolean':
      return { kind: 'boolean', value: '' };
    default:
      return { kind: 'text', contains: '' };
  }
}

/** Dialog inputs from the active conditions. */
export function draftFromFilters(filters: readonly ScoreFilter[], fields: readonly FieldDefinition[]): FilterDraft {
  const draft: FilterDraft = {};
  for (const { column, type } of filterColumns(fields)) {
    const input = emptyInput(type);
    const filter = filters.find((f) => f.column === column);
    if (filter) {
      if (input.kind === 'text' && filter.op === 'contains') input.contains = String(filter.value ?? '');
      if (input.kind === 'range' && filter.op === 'between' && Array.isArray(filter.value)) {
        const [from, to] = filter.value;
        const t = type as 'number' | 'date';
        input.from = from === RANGE_MIN[t] ? '' : String(from);
        input.to = to === RANGE_MAX[t] ? '' : String(to);
      }
      if (input.kind === 'options' && filter.op === 'in' && Array.isArray(filter.value)) input.ids = filter.value.map(String);
      if (input.kind === 'boolean' && filter.op === 'eq') input.value = filter.value === true ? 'true' : 'false';
    }
    draft[column] = input;
  }
  return draft;
}

/** API conditions from the dialog inputs; empty inputs are left out. */
export function filtersFromDraft(draft: FilterDraft, fields: readonly FieldDefinition[]): ScoreFilter[] {
  const result: ScoreFilter[] = [];
  for (const { column, type } of filterColumns(fields)) {
    const input = draft[column];
    if (!input) continue;
    if (input.kind === 'text' && input.contains.trim()) result.push({ column, op: 'contains', value: input.contains.trim() });
    if (input.kind === 'range' && (input.from || input.to)) {
      const t = type === 'date' ? 'date' : 'number';
      const parse = (v: string) => (t === 'number' ? Number(v.replace(',', '.')) : v);
      const from = input.from ? parse(input.from) : RANGE_MIN[t];
      const to = input.to ? parse(input.to) : RANGE_MAX[t];
      if (t === 'number' && (Number.isNaN(from) || Number.isNaN(to))) continue;
      result.push({ column, op: 'between', value: [from, to] as (string | number)[] });
    }
    if (input.kind === 'options' && input.ids.length) result.push({ column, op: 'in', value: input.ids });
    if (input.kind === 'boolean' && input.value) result.push({ column, op: 'eq', value: input.value === 'true' });
  }
  return result;
}

/** Short text of a condition for the chip below the search, e.g. „Schwierigkeitsgrad 2–5“. */
export function describeFilter(filter: ScoreFilter, fields: readonly FieldDefinition[], labels: { composer: string; publisher: string; yes: string; no: string }): string {
  const field = fields.find((f) => fieldColumn(f) === filter.column);
  const name = field?.name ?? (filter.column === 'composer' ? labels.composer : filter.column === 'publisher' ? labels.publisher : filter.column);
  if (filter.op === 'contains') return `${name}: „${String(filter.value)}“`;
  if (filter.op === 'between' && Array.isArray(filter.value)) {
    const t = field?.type === 'date' ? 'date' : 'number';
    const [from, to] = filter.value;
    const a = from === RANGE_MIN[t] ? '' : String(from);
    const b = to === RANGE_MAX[t] ? '' : String(to);
    if (a && b) return `${name} ${a}–${b}`;
    return a ? `${name} ≥ ${a}` : `${name} ≤ ${b}`;
  }
  if (filter.op === 'in' && Array.isArray(filter.value)) {
    const options = field?.options ?? [];
    return `${name}: ${filter.value.map((id) => options.find((o) => o.id === id)?.label ?? String(id)).join(', ')}`;
  }
  if (filter.op === 'eq' && typeof filter.value === 'boolean') return `${name}: ${filter.value ? labels.yes : labels.no}`;
  return name;
}

// ---------------------------------------------------------------------------------------------

/** Duration in seconds as „m:ss“ (Dauer). */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** „3:40“, „3“ (minutes) or „220s“ → seconds; empty → null; invalid → NaN. */
export function parseDuration(text: string): number | null {
  const value = text.trim();
  if (!value) return null;
  const mmss = /^(\d{1,3}):([0-5]\d)$/.exec(value);
  if (mmss) return Number(mmss[1]) * 60 + Number(mmss[2]);
  if (/^\d{1,3}$/.test(value)) return Number(value) * 60;
  return Number.NaN;
}
