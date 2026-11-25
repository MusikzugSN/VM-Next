import { downloadFileName, FILE_NAME_MAX, sanitizeFileName } from './file-names';

describe('sanitizeFileName', () => {
  it('replaces characters that are invalid in file names', () => {
    expect(sanitizeFileName('AC/DC: Highway?')).toBe('AC_DC_ Highway_');
    expect(sanitizeFileName('a\\b*c"d<e>f|g')).toBe('a_b_c_d_e_f_g');
  });

  it('keeps allowed characters', () => {
    expect(sanitizeFileName('Marsch – Nr. 3 (Flöte)')).toBe('Marsch – Nr. 3 (Flöte)');
  });

  it('strips control characters, collapses whitespace and drops trailing dots', () => {
    expect(sanitizeFileName('a\u0000b\u007f  c')).toBe('a_b_ c');
    expect(sanitizeFileName('Titel... ')).toBe('Titel');
  });

  it('never returns an empty name', () => {
    expect(sanitizeFileName('/:*?')).toBe('____');
    expect(sanitizeFileName('   ')).toBe('Dokument');
    expect(sanitizeFileName('')).toBe('Dokument');
  });
});

describe('downloadFileName', () => {
  it('appends the extension and cuts the base', () => {
    expect(downloadFileName('Marschbuch', 'zip')).toBe('Marschbuch.zip');
    expect(downloadFileName('x'.repeat(FILE_NAME_MAX + 50), 'pdf')).toBe(`${'x'.repeat(FILE_NAME_MAX)}.pdf`);
  });

  it('falls back instead of producing a name that is only an extension', () => {
    expect(downloadFileName('???', 'zip')).toBe('___.zip');
    expect(downloadFileName('', 'zip')).toBe('Dokument.zip');
  });
});
