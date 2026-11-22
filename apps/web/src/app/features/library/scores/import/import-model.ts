import {
  SCORE_IMPORT_NEW_FIELD_PREFIX,
  type CustomFieldType,
  type FieldDefinition,
  type ScoreImportAction,
  type ScoreImportBodyInput,
  type ScoreImportFixedField,
  type ScoreImportRow,
} from '@vm-web/shared';

import type { CsvTable } from './csv';

/**
 * Target of one CSV column (N-19), encoded as the value of the native select:
 * `ignore` · `fixed:<field>` · `field:<id>` · `new` (new custom field) · `folder` · `folderNumber`.
 */
export type ColumnTarget = 'ignore' | `fixed:${ScoreImportFixedField}` | `field:${string}` | 'new' | 'folder' | 'folderNumber';

export const FIXED_TARGETS: readonly ScoreImportFixedField[] = ['title', 'composer', 'arranger', 'publisher', 'publisherNumber', 'duration'];

/** Custom field types offered for new fields (links are rare in old lists but possible). */
export const NEW_FIELD_TYPES: readonly CustomFieldType[] = ['text', 'select', 'multiselect', 'number', 'boolean', 'date', 'link'];

export interface ColumnMapping {
  target: ColumnTarget;
  /** Only for `new`. */
  newName: string;
  newType: CustomFieldType;
}

export interface ImportSettings {
  columns: ColumnMapping[];
  /** Folder name for every row when no column is mapped to `folder`. */
  fixedFolder: string;
  folderEnsembleId: string;
}

const STORAGE_KEY = 'vm-web.score-import.mapping';

/** Header names that map to a fixed field without asking (lower case). */
const KNOWN_HEADERS: Record<string, ColumnTarget> = {
  titel: 'fixed:title',
  title: 'fixed:title',
  komponist: 'fixed:composer',
  komponisten: 'fixed:composer',
  composer: 'fixed:composer',
  arrangeur: 'fixed:arranger',
  bearbeiter: 'fixed:arranger',
  arranger: 'fixed:arranger',
  verlag: 'fixed:publisher',
  publisher: 'fixed:publisher',
  verlagsnummer: 'fixed:publisherNumber',
  'verlags-nr.': 'fixed:publisherNumber',
  dauer: 'fixed:duration',
  spieldauer: 'fixed:duration',
  mappe: 'folder',
  nummer: 'folderNumber',
  'nr.': 'folderNumber',
  nr: 'folderNumber',
  'mappen-nr.': 'folderNumber',
};

interface StoredColumn {
  target: ColumnTarget;
  newName?: string;
  newType?: CustomFieldType;
}

function loadStored(): Record<string, StoredColumn> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, StoredColumn>) : {};
  } catch {
    return {};
  }
}

/** Remembers the mapping per column name for the next import (N-19). */
export function storeMapping(headers: readonly string[], columns: readonly ColumnMapping[]): void {
  try {
    const stored = loadStored();
    headers.forEach((header, i) => {
      const c = columns[i];
      stored[header.toLowerCase()] = c.target === 'new' ? { target: 'new', newName: c.newName, newType: c.newType } : { target: c.target };
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Storage blocked: the mapping is simply not remembered.
  }
}

/**
 * Initial mapping: the remembered target for this column name, else a custom field with the same
 * name, else a known header name, else „nicht importieren“. Each fixed field is used only once.
 * A remembered „neues eigenes Feld“ that exists by now (created by the last import) maps to that field.
 */
export function initialMapping(headers: readonly string[], fields: readonly FieldDefinition[]): ColumnMapping[] {
  const stored = loadStored();
  const used = new Set<ColumnTarget>();
  const fieldIds = new Set(fields.map((f) => `field:${f.id}`));
  const fieldByName = (name: string | undefined) => fields.find((f) => f.name.toLowerCase() === (name ?? '').trim().toLowerCase());
  return headers.map((header) => {
    const key = header.toLowerCase();
    const remembered = stored[key];
    const sameName = fieldByName(key);
    const created = remembered?.target === 'new' ? fieldByName(remembered.newName) : undefined;
    let target: ColumnTarget = 'ignore';
    if (created) target = `field:${created.id}`;
    else if (remembered && (!remembered.target.startsWith('field:') || fieldIds.has(remembered.target))) target = remembered.target;
    else if (sameName) target = `field:${sameName.id}`;
    else if (KNOWN_HEADERS[key]) target = KNOWN_HEADERS[key];
    if (target !== 'ignore' && target !== 'new' && used.has(target)) target = 'ignore';
    used.add(target);
    return { target, newName: remembered?.newName ?? header.slice(0, 100), newType: remembered?.newType ?? 'text' };
  });
}

/** Problems that block the preview: title not mapped, a target used twice, a new field without name. */
export function mappingProblems(columns: readonly ColumnMapping[], fields: readonly FieldDefinition[]): string[] {
  const problems: string[] = [];
  if (!columns.some((c) => c.target === 'fixed:title')) problems.push('titleMissing');
  const single = columns.filter((c) => c.target !== 'ignore' && c.target !== 'new').map((c) => c.target);
  if (new Set(single).size !== single.length) problems.push('duplicateTarget');
  const names = columns.filter((c) => c.target === 'new').map((c) => c.newName.trim().toLowerCase());
  if (names.some((n) => !n)) problems.push('newFieldName');
  const existing = new Set(fields.map((f) => f.name.toLowerCase()));
  if (names.some((n) => existing.has(n)) || new Set(names).size !== names.length) problems.push('newFieldTaken');
  return problems;
}

export function usesFolder(columns: readonly ColumnMapping[], settings: Pick<ImportSettings, 'fixedFolder'>): boolean {
  return columns.some((c) => c.target === 'folder') || settings.fixedFolder.trim() !== '';
}

/** Request body for `scores/scores/import`: raw cells of the mapped columns per row. */
export function buildImportBody(
  table: CsvTable,
  settings: ImportSettings,
  actions: ReadonlyMap<number, ScoreImportAction>,
  dryRun: boolean,
): ScoreImportBodyInput {
  const { columns } = settings;
  const newKey = (i: number) => `col-${i}`;
  const folderColumn = columns.findIndex((c) => c.target === 'folder');
  const numberColumn = columns.findIndex((c) => c.target === 'folderNumber');
  const withFolder = usesFolder(columns, settings);

  const rows: ScoreImportRow[] = table.rows.map(({ line, cells }) => {
    const fixed: ScoreImportRow['fixed'] = {};
    const custom: Record<string, string> = {};
    columns.forEach((c, i) => {
      if (c.target.startsWith('fixed:')) fixed[c.target.slice(6) as ScoreImportFixedField] = cells[i];
      else if (c.target.startsWith('field:')) custom[c.target.slice(6)] = cells[i];
      else if (c.target === 'new') custom[SCORE_IMPORT_NEW_FIELD_PREFIX + newKey(i)] = cells[i];
    });
    const name = folderColumn >= 0 ? cells[folderColumn].trim() : settings.fixedFolder.trim();
    const folder = withFolder && name ? { name, number: numberColumn >= 0 ? cells[numberColumn] : '' } : null;
    const action = actions.get(line);
    return { line, fixed, custom, folder, ...(action ? { action } : {}) };
  });

  return {
    dryRun,
    newFields: columns.flatMap((c, i) => (c.target === 'new' ? [{ key: newKey(i), name: c.newName.trim(), type: c.newType }] : [])),
    folderEnsembleId: withFolder ? settings.folderEnsembleId || null : null,
    rows,
  };
}

/** Up to three different non-empty example values of a column. */
export function examples(table: CsvTable, column: number): string[] {
  const seen = new Set<string>();
  for (const row of table.rows) {
    const value = row.cells[column]?.trim();
    if (value) seen.add(value.length > 40 ? `${value.slice(0, 40)}…` : value);
    if (seen.size >= 3) break;
  }
  return [...seen];
}
