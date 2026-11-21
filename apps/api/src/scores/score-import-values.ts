import type { CustomFieldType } from '@vm-web/shared';

/** Result of converting one CSV cell: `value` (`null` = empty) or an issue `code`. */
export type Parsed<T> = { value: T | null; code?: undefined } | { value?: undefined; code: string };

const TRUE = new Set(['true', 'wahr', 'ja', 'j', 'yes', 'y', 'x', '1', '✓', '✔']);
const FALSE = new Set(['false', 'falsch', 'nein', 'n', 'no', '0', '-']);

/** Key for matching scores: case-insensitive, whitespace collapsed (N-19). */
export function matchKey(value: string | null | undefined): string {
  return (value ?? '').normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('de');
}

export function parseText(raw: string | undefined, max: number): Parsed<string> {
  const text = (raw ?? '').trim();
  if (!text) return { value: null };
  if (text.length > max) return { code: 'too_big' };
  return { value: text };
}

/** `1,5`, `1.5`, `1.234,5` (German thousands), `-3`. */
export function parseNumber(raw: string | undefined): Parsed<number> {
  let text = (raw ?? '').trim().replace(/\s/g, '');
  if (!text) return { value: null };
  if (text.includes(',')) text = text.replace(/\./g, '').replace(',', '.');
  if (!/^[-+]?\d*\.?\d+(e[-+]?\d+)?$/i.test(text)) return { code: 'invalid_number' };
  const value = Number(text);
  return Number.isFinite(value) ? { value } : { code: 'invalid_number' };
}

export function parseBoolean(raw: string | undefined): Parsed<boolean> {
  const text = (raw ?? '').trim().toLowerCase();
  if (!text) return { value: null };
  if (TRUE.has(text)) return { value: true };
  if (FALSE.has(text)) return { value: false };
  return { code: 'invalid_boolean' };
}

/** `TT.MM.JJJJ` (also `T.M.JJ`… with four-digit year) or ISO `JJJJ-MM-TT` → ISO date. */
export function parseDate(raw: string | undefined): Parsed<string> {
  const text = (raw ?? '').trim();
  if (!text) return { value: null };
  const de = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(text);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  const [y, m, d] = de ? [+de[3], +de[2], +de[1]] : iso ? [+iso[1], +iso[2], +iso[3]] : [0, 0, 0];
  if (!y) return { code: 'invalid_date' };
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return { code: 'invalid_date' };
  return { value: `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` };
}

/** `m:ss`, `h:mm:ss` or whole seconds → seconds (max. 24 h, like the score form). */
export function parseDuration(raw: string | undefined): Parsed<number> {
  const text = (raw ?? '').trim();
  if (!text) return { value: null };
  let seconds: number;
  if (/^\d+$/.test(text)) {
    seconds = Number(text);
  } else {
    const parts = /^(?:(\d+):)?(\d{1,3}):(\d{2})$/.exec(text);
    if (!parts || Number(parts[3]) > 59) return { code: 'invalid_duration' };
    seconds = Number(parts[1] ?? 0) * 3600 + Number(parts[2]) * 60 + Number(parts[3]);
  }
  return seconds <= 86_400 ? { value: seconds } : { code: 'invalid_duration' };
}

export function parseLink(raw: string | undefined): Parsed<string> {
  const text = parseText(raw, 2000);
  if (text.code !== undefined || text.value === null) return text;
  try {
    const url = new URL(text.value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? text : { code: 'invalid_link' };
  } catch {
    return { code: 'invalid_link' };
  }
}

/** Labels of a select / multiselect cell; multiselect values are separated by `,` or `;`. */
export function parseLabels(raw: string | undefined, multiple: boolean): string[] {
  const text = (raw ?? '').trim();
  if (!text) return [];
  const labels = multiple ? text.split(/[,;]/) : [text];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const label of labels.map((l) => l.trim().slice(0, 100)).filter(Boolean)) {
    if (seen.has(label.toLowerCase())) continue;
    seen.add(label.toLowerCase());
    result.push(label);
  }
  return result;
}

/** Converts a cell for a custom field type without options (select types are resolved by the service). */
export function parseScalar(type: Exclude<CustomFieldType, 'select' | 'multiselect'>, raw: string | undefined): Parsed<unknown> {
  switch (type) {
    case 'text':
      return parseText(raw, 2000);
    case 'link':
      return parseLink(raw);
    case 'number':
      return parseNumber(raw);
    case 'boolean':
      return parseBoolean(raw);
    case 'date':
      return parseDate(raw);
  }
}
