import { degrees, PDFDocument } from 'pdf-lib';
import { buildSheetPdf, cropToUserSpace, inspectPdf, InvalidPdfError } from './pdf-tools';
import { suggestVoice, tokenize } from './voice-suggestion';

const VOICES = [
  'Flöte 1',
  'Flöte 2',
  'Klarinette 1 in B',
  'Klarinette 2 in B',
  'Bassklarinette in B',
  'Altsaxophon 1 in Es',
  'Altsaxophon 2 in Es',
  'Tenorsaxophon in B',
  'Baritonsaxophon in Es',
  'Flügelhorn 1 in B',
  'Flügelhorn 2 in B',
  'Trompete 1 in B',
  'Trompete 2 in B',
  'Trompete 3 in B',
  'Horn 1 in F',
  'Horn 2 in F',
  'Horn 1 in Es',
  'Tenorhorn 1 in B',
  'Bariton in B',
  'Posaune 1 in C',
  'Posaune 2 in C',
  'Tuba in C',
  'Tuba in B',
  'Schlagzeug',
].map((name, i) => ({ id: `v${i}`, name }));

const suggest = (file: string) => suggestVoice(file, VOICES)?.name ?? null;

describe('suggestVoice (N-11)', () => {
  it.each([
    ['Böhmischer Traum - Trompete 1.pdf', 'Trompete 1 in B'],
    ['Boehmischer_Traum_Trp2.pdf', 'Trompete 2 in B'],
    ['Alte Kameraden - Flgh 1 Bb.pdf', 'Flügelhorn 1 in B'],
    ['Fluegelhorn2.pdf', 'Flügelhorn 2 in B'],
    ['marsch_klar_2.pdf', 'Klarinette 2 in B'],
    ['Marsch - Bassklarinette.pdf', 'Bassklarinette in B'],
    ['Marsch - Alt Sax 2 Es.pdf', 'Altsaxophon 2 in Es'],
    ['Marsch - Bari Sax.pdf', 'Baritonsaxophon in Es'],
    ['Marsch - Bariton.pdf', 'Bariton in B'],
    ['Marsch Horn 1 F.pdf', 'Horn 1 in F'],
    ['Marsch Horn 1 Es.pdf', 'Horn 1 in Es'],
    ['Marsch Hrn1.pdf', 'Horn 1 in F'],
    ['Tenorhorn 1.pdf', 'Tenorhorn 1 in B'],
    ['Tuba Bb.pdf', 'Tuba in B'],
    ['Tuba.pdf', 'Tuba in C'],
    ['Pos 2.pdf', 'Posaune 2 in C'],
    ['Flöte 1.pdf', 'Flöte 1'],
    ['Drums.pdf', 'Schlagzeug'],
  ])('%s → %s', (file, expected) => {
    expect(suggest(file)).toBe(expected);
  });

  it.each(['scan_0042.pdf', 'Partitur.pdf', 'Trompete 5.pdf'])('suggests nothing for %s', (file) => {
    expect(suggest(file)).toBeNull();
  });

  it('splits letters and digits', () => {
    expect(tokenize('Trp1in-Bb.PDF')).toEqual(['trp', '1', 'in', 'bb']);
  });
});

describe('cropToUserSpace (N-12)', () => {
  const box = { x: 0, y: 0, width: 600, height: 800 };
  // a crop of the top-left quarter as seen on screen
  const quarter = { x: 0, y: 0, width: 0.5, height: 0.5 };

  it('maps the displayed top-left quarter for every rotation', () => {
    // 0°: top-left of the page
    expect(cropToUserSpace(0, box, quarter)).toEqual({ x: 0, y: 400, width: 300, height: 400 });
    // 90° clockwise: displayed top-left is the page's bottom-left
    expect(cropToUserSpace(90, box, quarter)).toEqual({ x: 0, y: 0, width: 300, height: 400 });
    // 180°: displayed top-left is the page's bottom-right
    expect(cropToUserSpace(180, box, quarter)).toEqual({ x: 300, y: 0, width: 300, height: 400 });
    // 270°: displayed top-left is the page's top-right
    expect(cropToUserSpace(270, box, quarter)).toEqual({ x: 300, y: 400, width: 300, height: 400 });
  });

  it('respects offset boxes and clamps to the page', () => {
    expect(cropToUserSpace(0, { x: 10, y: 20, width: 100, height: 200 }, { x: 0.5, y: 0.5, width: 0.9, height: 0.9 })).toEqual({
      x: 60,
      y: 20,
      width: 50,
      height: 100,
    });
  });
});

async function pdfWith(pageCount: number, opts: { rotate?: number } = {}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    const page = doc.addPage([600, 800]);
    page.drawText(`Seite ${i + 1}`, { x: 50, y: 700 });
    if (opts.rotate) page.setRotation(degrees(opts.rotate));
  }
  return doc.save();
}

describe('inspectPdf', () => {
  it('returns the page count of valid PDFs', async () => {
    expect(await inspectPdf(await pdfWith(3))).toEqual({ pageCount: 3 });
  });

  it.each([
    ['not_pdf', Buffer.from('PK\u0003\u0004 a zip file')],
    ['damaged', Buffer.from('%PDF-1.7\nthis is not really a pdf')],
  ])('rejects %s', async (problem, bytes) => {
    await expect(inspectPdf(bytes)).rejects.toEqual(new InvalidPdfError(problem as 'not_pdf'));
  });
});

describe('buildSheetPdf (N-12)', () => {
  it('selects, reorders, rotates and crops pages', async () => {
    const source = await pdfWith(3, { rotate: 90 });
    const { bytes, pageCount } = await buildSheetPdf(source, [
      { sourcePage: 3, rotation: 0, crop: null },
      { sourcePage: 1, rotation: 270, crop: { x: 0, y: 0, width: 0.5, height: 0.5 } },
    ]);
    expect(pageCount).toBe(2);
    const doc = await PDFDocument.load(bytes);
    const [first, second] = doc.getPages();
    expect(first.getRotation().angle).toBe(90);
    expect(second.getRotation().angle).toBe(0); // 90 + 270
    expect(second.getCropBox()).toEqual({ x: 0, y: 400, width: 300, height: 400 });
    // the source stays untouched
    expect((await PDFDocument.load(source)).getPageCount()).toBe(3);
  });

  it('fails for pages that do not exist', async () => {
    await expect(buildSheetPdf(await pdfWith(1), [{ sourcePage: 2, rotation: 0, crop: null }])).rejects.toThrow();
  });
});
