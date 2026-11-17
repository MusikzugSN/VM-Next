/** UTF-8 BOM so that Excel opens the file with the right encoding (F-10). */
export const CSV_BOM = String.fromCharCode(0xfeff);

/**
 * One CSV cell (`;`-separated). Cells that a spreadsheet would run as a formula
 * (`=`, `+`, `-`, `@`, tab, CR) get a leading apostrophe (CSV injection).
 */
export function csvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function csvLine(cells: readonly (string | number | boolean | null | undefined)[]): string {
  return cells.map(csvCell).join(';') + '\r\n';
}
