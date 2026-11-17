const MAX_BASE_LENGTH = 150;
const SEPARATOR = ' – ';

/** Replaces characters that are invalid in file names on Windows/macOS/Linux and trims the result. */
export function sanitizeFileName(name: string): string {
  const cleaned = name
    .normalize('NFC')
    // eslint-disable-next-line no-control-regex
    .replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '');
  return cleaned || 'Dokument';
}

/**
 * File name of a sheet (M-6): „Nr – Titel – Stimme.pdf“, without number outside folders/events.
 * The base name is cut to 150 characters.
 */
export function sheetFileName(parts: { number?: string | null; title: string; voice: string }): string {
  const base = [parts.number, parts.title, parts.voice]
    .filter((p): p is string => !!p && !!p.trim())
    .map(sanitizeFileName)
    .join(SEPARATOR);
  return `${base.slice(0, MAX_BASE_LENGTH).trim()}.pdf`;
}

/** Makes names unique within one ZIP: „x.pdf“, „x (2).pdf“, „x (3).pdf“ … (case-insensitive). */
export function uniqueNames(names: readonly string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((name) => {
    const key = name.toLowerCase();
    const count = (seen.get(key) ?? 0) + 1;
    seen.set(key, count);
    if (count === 1) return name;
    const dot = name.lastIndexOf('.');
    const candidate = dot > 0 ? `${name.slice(0, dot)} (${count})${name.slice(dot)}` : `${name} (${count})`;
    seen.set(candidate.toLowerCase(), 1);
    return candidate;
  });
}

/** `Content-Disposition` with ASCII fallback and UTF-8 name (RFC 6266 / 5987). */
export function contentDisposition(type: 'inline' | 'attachment', fileName: string): string {
  const ascii = fileName
    .normalize('NFKD')
    .replace(/[^\x20-\x7e]/g, '')
    .replace(/["\\]/g, '_');
  const encoded = encodeURIComponent(fileName).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${type}; filename="${ascii || 'download'}"; filename*=UTF-8''${encoded}`;
}
