export const FILE_NAME_MAX = 150;

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

export function downloadFileName(base: string, extension: 'pdf' | 'zip'): string {
  return `${sanitizeFileName(base).slice(0, FILE_NAME_MAX).trim()}.${extension}`;
}
