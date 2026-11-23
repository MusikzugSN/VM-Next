import type { ScoreColumn, ScoreFilter, ValidationError } from '@vm-web/shared';
import { sql, type SQL } from 'drizzle-orm';
import { ProblemException } from '../common/problem-details/problem.exception';
import { scores } from '../db/schema';
import type { FieldDef } from './custom-fields';
import { likePattern } from '../common/sql';

type Kind = 'text' | 'number' | 'date' | 'boolean' | 'select' | 'multiselect' | 'completeness';

interface Column {
  kind: Kind;
  /** Raw value (text, numeric …) used for filters. */
  value: SQL;
  /** Value used for ordering; `null` handled by the null flag. */
  sort: SQL;
  /** SQL cast of the sort value in cursors. */
  cast: 'text' | 'numeric' | 'boolean';
  /** Whether the value is empty (null or empty string / no stored key). */
  empty: SQL;
  fieldKey?: string;
}

const FIXED_TEXT = {
  title: scores.title,
  composer: scores.composer,
  arranger: scores.arranger,
  publisher: scores.publisher,
  publisherNumber: scores.publisherNumber,
} as const;

const OPERATORS: Record<Kind, ScoreFilter['op'][]> = {
  text: ['contains', 'eq', 'neq', 'in', 'empty', 'not-empty'],
  number: ['eq', 'neq', 'lt', 'gt', 'between', 'in', 'empty', 'not-empty'],
  date: ['eq', 'neq', 'lt', 'gt', 'between', 'empty', 'not-empty'],
  boolean: ['eq', 'empty', 'not-empty'],
  select: ['eq', 'neq', 'in', 'empty', 'not-empty'],
  multiselect: ['eq', 'in', 'empty', 'not-empty'],
  completeness: [],
};

/** Present lineup voices of a score (sort by completeness, N-4). */
export function presentCountSql(ensembleId: string | null): SQL {
  if (!ensembleId) return sql`0`;
  return sql`(select count(*) from ensemble_lineup_voices lv
                join sheets s on s.voice_id = lv.voice_id and s.score_id = ${scores.id}
               where lv.ensemble_id = ${ensembleId}::uuid)`;
}

/** Resolves a column name (fixed or `field:<id>`) to SQL, or `undefined` for unknown fields. */
export function resolveColumn(column: ScoreColumn, fields: ReadonlyMap<string, FieldDef>, ensembleId: string | null): Column | undefined {
  if (column in FIXED_TEXT) {
    const col = FIXED_TEXT[column as keyof typeof FIXED_TEXT];
    return { kind: 'text', value: sql`${col}`, sort: sql`lower(${col})`, cast: 'text', empty: sql`coalesce(${col}, '') = ''` };
  }
  if (column === 'durationSeconds') {
    return { kind: 'number', value: sql`${scores.durationSeconds}`, sort: sql`${scores.durationSeconds}`, cast: 'numeric', empty: sql`${scores.durationSeconds} is null` };
  }
  if (column === 'completeness') {
    const present = presentCountSql(ensembleId);
    return { kind: 'completeness', value: present, sort: present, cast: 'numeric', empty: sql`false` };
  }

  const key = column.slice('field:'.length);
  const def = fields.get(key);
  if (!def) return undefined;
  const text = sql`(${scores.customValues} ->> ${key})`;
  const empty = sql`not jsonb_exists(${scores.customValues}, ${key})`;
  switch (def.type) {
    case 'text':
    case 'link':
      return { kind: 'text', value: text, sort: sql`lower(${text})`, cast: 'text', empty, fieldKey: key };
    case 'number':
      return { kind: 'number', value: sql`${text}::numeric`, sort: sql`${text}::numeric`, cast: 'numeric', empty, fieldKey: key };
    case 'date':
      return { kind: 'date', value: text, sort: text, cast: 'text', empty, fieldKey: key };
    case 'boolean':
      return { kind: 'boolean', value: sql`${text}::boolean`, sort: sql`${text}::boolean`, cast: 'boolean', empty, fieldKey: key };
    case 'select':
      return {
        kind: 'select',
        value: text,
        sort: sql`(select lower(o.label) from field_options o where o.id::text = ${text})`,
        cast: 'text',
        empty,
        fieldKey: key,
      };
    case 'multiselect':
      return {
        kind: 'multiselect',
        value: sql`(${scores.customValues} -> ${key})`,
        sort: sql`(select lower(string_agg(o.label, ', ' order by o.position)) from field_options o
                    where jsonb_exists(${scores.customValues} -> ${key}, o.id::text))`,
        cast: 'text',
        empty,
        fieldKey: key,
      };
  }
}

const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isString = (v: unknown): v is string => typeof v === 'string';
const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** SQL for one filter condition; throws 400 with a pointer into `filter` on misuse. */
function filterSql(f: ScoreFilter, col: Column, index: number): SQL {
  const at = (field: 'op' | 'value', code: string): ValidationError => ({ path: `/query/filter/${index}/${field}`, code });
  if (!OPERATORS[col.kind].includes(f.op)) throw ProblemException.validation([at('op', 'unsupported_operator')]);
  if (f.op === 'empty') return col.empty;
  if (f.op === 'not-empty') return sql`not (${col.empty})`;

  const v = f.value;
  const check = (ok: boolean) => {
    if (!ok) throw ProblemException.validation([at('value', 'invalid_type')]);
  };
  const scalarOk = (x: unknown) =>
    col.kind === 'number' ? isNumber(x) : col.kind === 'date' ? isDate(x) : col.kind === 'boolean' ? typeof x === 'boolean' : isString(x);
  const typed = (x: unknown) =>
    col.kind === 'number' ? sql`${x}::numeric` : col.kind === 'boolean' ? sql`${x}::boolean` : sql`${x}::text`;
  const caseless = col.kind === 'text';
  const lhs = caseless ? sql`lower(${col.value})` : col.value;
  const rhs = (x: unknown) => (caseless ? sql`lower(${x}::text)` : typed(x));

  switch (f.op) {
    case 'contains':
      check(isString(v) && v.length > 0);
      return sql`${col.value} ilike ${likePattern(v as string)}`;
    case 'eq':
    case 'neq': {
      check(scalarOk(v));
      if (col.kind === 'multiselect') return sql`jsonb_exists(${col.value}, ${v}::text)`;
      return f.op === 'eq' ? sql`${lhs} = ${rhs(v)}` : sql`(${lhs} is distinct from ${rhs(v)})`;
    }
    case 'lt':
    case 'gt':
      check(scalarOk(v));
      return f.op === 'lt' ? sql`${col.value} < ${typed(v)}` : sql`${col.value} > ${typed(v)}`;
    case 'between': {
      check(Array.isArray(v) && v.length === 2 && v.every(scalarOk));
      const [from, to] = v as unknown[];
      return sql`${col.value} between ${typed(from)} and ${typed(to)}`;
    }
    case 'in': {
      check(Array.isArray(v) && v.length > 0 && v.length <= 50 && v.every(scalarOk));
      const items = v as unknown[];
      if (col.kind === 'multiselect') {
        return sql`jsonb_exists_any(${col.value}, array[${sql.join(items.map((x) => sql`${x}::text`), sql`, `)}])`;
      }
      return sql`${lhs} in (${sql.join(items.map(rhs), sql`, `)})`;
    }
    default:
      throw ProblemException.validation([at('op', 'unsupported_operator')]);
  }
}

/** All filter conditions (AND); unknown custom fields are a 400 on `/query/filter/<i>/column`. */
export function buildFilters(filters: readonly ScoreFilter[], fields: ReadonlyMap<string, FieldDef>, ensembleId: string | null): SQL[] {
  return filters.map((f, i) => {
    const col = resolveColumn(f.column, fields, ensembleId);
    if (!col) throw ProblemException.validation([{ path: `/query/filter/${i}/column`, code: 'unknown_field' }]);
    return filterSql(f, col, i);
  });
}

/** Full text over fixed text fields and text values of custom fields. */
export function searchSql(q: string): SQL {
  const p = likePattern(q);
  return sql`(${scores.title} ilike ${p} or ${scores.composer} ilike ${p} or ${scores.arranger} ilike ${p}
          or ${scores.publisher} ilike ${p} or ${scores.publisherNumber} ilike ${p}
          or exists (select 1 from jsonb_each(${scores.customValues}) e
                      where jsonb_typeof(e.value) = 'string' and e.value #>> '{}' ilike ${p}))`;
}

export interface SortPlan {
  /** Selected as `sortEmpty` (0/1) and `sortValue` for the cursor. */
  emptyFlag: SQL<number>;
  value: SQL;
  cast: Column['cast'];
  dir: 'asc' | 'desc';
  orderBy: SQL[];
}

/** Sort by any column; empty values always last, ties broken by id. */
export function buildSort(column: ScoreColumn, dir: 'asc' | 'desc', fields: ReadonlyMap<string, FieldDef>, ensembleId: string | null): SortPlan {
  const col = resolveColumn(column, fields, ensembleId);
  if (!col) throw ProblemException.validation([{ path: '/query/sort', code: 'unknown_field' }]);
  const emptyFlag = sql<number>`(case when ${col.sort} is null then 1 else 0 end)`;
  const direction = dir === 'asc' ? sql`asc` : sql`desc`;
  return {
    emptyFlag,
    value: col.sort,
    cast: col.cast,
    dir,
    orderBy: [sql`${emptyFlag} asc`, sql`${col.sort} ${direction}`, sql`${scores.id} ${direction}`],
  };
}

/** Keyset condition „after the cursor row“ matching `buildSort`'s order. */
export function afterCursor(plan: SortPlan, cursor: readonly (string | number | null)[]): SQL {
  const [empty, value, id] = cursor;
  const cmp = plan.dir === 'asc' ? sql`>` : sql`<`;
  const idAfter = sql`${scores.id} ${cmp} ${id}::uuid`;
  if (empty === 1) {
    // within the empty block only the id decides
    return sql`(${plan.emptyFlag} = 1 and ${idAfter})`;
  }
  const typed = sql`${value}::${sql.raw(plan.cast)}`;
  return sql`(${plan.emptyFlag} = 1 or (${plan.value} ${cmp} ${typed}) or (${plan.value} = ${typed} and ${idAfter}))`;
}
