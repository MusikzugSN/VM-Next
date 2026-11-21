import { decodeCsv, detectDelimiter, parseCsv } from './csv';

describe('CSV reader (N-19)', () => {
  it('reads quoted cells with delimiters, line breaks and escaped quotes', () => {
    const text = 'Stück,Nummer,Kommentare\r\n"309  | Abendsegen aus ""Hänsel und Gretel""",309,"* "\r\n580  | Italienische Sehnsucht,580,"Musik: A\nText: B"\r\n\r\n';
    const table = parseCsv(text);
    expect(table.headers).toEqual(['Stück', 'Nummer', 'Kommentare']);
    expect(table.rows).toEqual([
      { line: 2, cells: ['309  | Abendsegen aus "Hänsel und Gretel"', '309', '* '] },
      { line: 3, cells: ['580  | Italienische Sehnsucht', '580', 'Musik: A\nText: B'] },
    ]);
  });

  it('counts lines inside quoted cells for later rows', () => {
    const table = parseCsv('a,b\n"x\ny",1\nz,2');
    expect(table.rows.map((r) => r.line)).toEqual([2, 4]);
  });

  it('detects semicolons and tabs, ignoring quoted delimiters', () => {
    expect(detectDelimiter('"a,b";c;d\n1;2;3')).toBe(';');
    expect(detectDelimiter('a\tb\n')).toBe('\t');
    expect(detectDelimiter('Titel')).toBe(',');
  });

  it('pads short rows and names empty headers', () => {
    const table = parseCsv('Titel,,Genre\nMarsch');
    expect(table.headers).toEqual(['Titel', 'Spalte 2', 'Genre']);
    expect(table.rows[0].cells).toEqual(['Marsch', '', '']);
  });

  it('decodes UTF-8 with BOM and falls back to Windows-1252', () => {
    const utf8 = new TextEncoder().encode('﻿Titel\nGrüße');
    expect(decodeCsv(utf8.buffer as ArrayBuffer)).toEqual({ text: 'Titel\nGrüße', encoding: 'utf-8' });
    const ansi = new Uint8Array([0x47, 0x72, 0xfc, 0xdf, 0x65]); // „Grüße“ in Windows-1252
    expect(decodeCsv(ansi.buffer)).toEqual({ text: 'Grüße', encoding: 'windows-1252' });
  });
});
