import type { CustomFieldType, ValidationError } from '@vm-web/shared';
import { idSchema, isoDateSchema } from '@vm-web/shared';

export interface FieldDef {
  id: string;
  name: string;
  type: CustomFieldType;
  required: boolean;
  /** Display order (N-2); irrelevant for validation. */
  position?: number;
  options: { id: string; label: string }[];
}

const TEXT_MAX = 2000;

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Normalizes one value; `undefined` = invalid, `null` = empty. */
function normalize(def: FieldDef, value: unknown): { value?: unknown; code?: string } {
  if (value === null || value === undefined) return { value: null };
  const optionIds = new Set(def.options.map((o) => o.id));
  switch (def.type) {
    case 'text':
    case 'link': {
      if (typeof value !== 'string') return { code: 'invalid_type' };
      const text = value.trim();
      if (!text) return { value: null };
      if (text.length > TEXT_MAX) return { code: 'too_big' };
      if (def.type === 'link' && !isHttpUrl(text)) return { code: 'invalid_format' };
      return { value: text };
    }
    case 'number':
      return typeof value === 'number' && Number.isFinite(value) ? { value } : { code: 'invalid_type' };
    case 'boolean':
      return typeof value === 'boolean' ? { value } : { code: 'invalid_type' };
    case 'date':
      return typeof value === 'string' && isoDateSchema.safeParse(value).success ? { value } : { code: 'invalid_format' };
    case 'select':
      if (typeof value !== 'string' || !idSchema.safeParse(value).success) return { code: 'invalid_type' };
      return optionIds.has(value) ? { value } : { code: 'invalid_option' };
    case 'multiselect': {
      if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) return { code: 'invalid_type' };
      const unique = [...new Set(value as string[])];
      if (unique.some((v) => !optionIds.has(v))) return { code: 'invalid_option' };
      return { value: unique.length ? unique : null };
    }
  }
}

/**
 * Checks custom field values against their definitions (N-2): type, option ids, required.
 * Returns only non-empty values (empty ones are not stored). Unknown field ids are errors.
 */
export function validateCustomValues(
  defs: readonly FieldDef[],
  input: Record<string, unknown>,
  pathPrefix = '/body/customFields',
): { values: Record<string, unknown>; errors: ValidationError[] } {
  const byId = new Map(defs.map((d) => [d.id, d]));
  const values: Record<string, unknown> = {};
  const errors: ValidationError[] = [];

  for (const key of Object.keys(input)) {
    if (!byId.has(key)) errors.push({ path: `${pathPrefix}/${key}`, code: 'unknown_field' });
  }
  for (const def of defs) {
    const result = normalize(def, input[def.id]);
    if (result.code) {
      errors.push({ path: `${pathPrefix}/${def.id}`, code: result.code });
    } else if (result.value === null) {
      if (def.required) errors.push({ path: `${pathPrefix}/${def.id}`, code: 'required' });
    } else {
      values[def.id] = result.value;
    }
  }
  return { values, errors };
}

/** Removes values that no longer fit after a field or option change (e.g. deleted options). */
export function pruneValues(def: FieldDef, value: unknown): unknown {
  const result = normalize(def, value);
  if (result.code !== undefined) {
    if (def.type === 'multiselect' && Array.isArray(value)) {
      const ids = new Set(def.options.map((o) => o.id));
      const kept = (value as string[]).filter((v) => ids.has(v));
      return kept.length ? kept : null;
    }
    return null;
  }
  return result.value;
}

/** Display text of a stored value, e.g. for the CSV export (N-3). */
export function displayValue(def: FieldDef, value: unknown): string {
  if (value === null || value === undefined) return '';
  const label = (id: unknown) => def.options.find((o) => o.id === id)?.label ?? '';
  switch (def.type) {
    case 'select':
      return label(value);
    case 'multiselect':
      return Array.isArray(value) ? value.map(label).filter(Boolean).join(', ') : '';
    case 'boolean':
      return value ? 'true' : 'false';
    default:
      return String(value);
  }
}
