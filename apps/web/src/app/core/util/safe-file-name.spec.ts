import { safeFileName } from './safe-file-name';

describe('safeFileName', () => {
  it('replaces runs of forbidden characters with one space and trims', () => {
    expect(safeFileName(' a/b\\c:*?d" <e>|')).toBe('a b c d   e');
  });

  it('keeps allowed characters', () => {
    expect(safeFileName('Marsch – Nr. 3 (Flöte)')).toBe('Marsch – Nr. 3 (Flöte)');
  });
});
