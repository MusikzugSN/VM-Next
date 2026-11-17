import { degrees, PDFDocument } from 'pdf-lib';
import { A4, blankPagesAfter, buildPrintPdf, MARGIN, placePage, printRoute } from './print-layout';

describe('blankPagesAfter (D-1, F-8)', () => {
  it('adds a blank page after odd page counts in duplex, never after the last document', () => {
    expect(blankPagesAfter([1, 2, 3, 1], true)).toEqual([1, 0, 1, 0]);
    expect(blankPagesAfter([1, 3], false)).toEqual([0, 0]);
    expect(blankPagesAfter([], true)).toEqual([]);
  });
});

describe('printRoute (D-2, D-3)', () => {
  it('uses the browser up to the page limit and the print service above it', () => {
    expect(printRoute(10, 10)).toBe('browser');
    expect(printRoute(11, 10)).toBe('print-service');
  });
});

describe('placePage (D-1)', () => {
  const portrait = { width: 600, height: 800 };
  const inside = (p: ReturnType<typeof placePage>, shown: { width: number; height: number }) => {
    const w = shown.width * p.scale;
    const h = shown.height * p.scale;
    const left = (p.page.width - w) / 2;
    const bottom = (p.page.height - h) / 2;
    return { left, bottom, right: left + w, top: bottom + h };
  };

  it('fits a portrait page into A4 with margins, centred', () => {
    const p = placePage(portrait, 0);
    expect(p.page).toEqual({ width: A4.width, height: A4.height });
    expect(p.rotate).toBe(0);
    const box = inside(p, portrait);
    expect(box.left).toBeGreaterThanOrEqual(MARGIN - 0.01);
    expect(box.bottom).toBeGreaterThanOrEqual(MARGIN - 0.01);
    expect(p.x).toBeCloseTo(box.left);
    expect(p.y).toBeCloseTo(box.bottom);
  });

  it('puts landscape pages on A4 landscape', () => {
    expect(placePage({ width: 842, height: 595 }, 0).page).toEqual({ width: A4.height, height: A4.width });
    // a portrait page rotated by 90° is shown as landscape
    expect(placePage(portrait, 90).page).toEqual({ width: A4.height, height: A4.width });
  });

  it.each([
    [90, -90],
    [180, -180],
    [270, -270],
  ])('moves the origin so that a page rotated by %i° lands in the box', (rotation, rotate) => {
    const p = placePage(portrait, rotation);
    expect(p.rotate).toBe(rotate);
    const shown = rotation === 180 ? portrait : { width: portrait.height, height: portrait.width };
    const box = inside(p, shown);
    const w = portrait.width * p.scale;
    const h = portrait.height * p.scale;
    // corners of the content box after rotating around (x, y) – must equal the target box
    const rad = (rotate * Math.PI) / 180;
    const corners = [
      [0, 0],
      [w, 0],
      [0, h],
      [w, h],
    ].map(([cx, cy]) => [p.x + cx * Math.cos(rad) - cy * Math.sin(rad), p.y + cx * Math.sin(rad) + cy * Math.cos(rad)]);
    const xs = corners.map((c) => c[0]);
    const ys = corners.map((c) => c[1]);
    expect(Math.min(...xs)).toBeCloseTo(box.left);
    expect(Math.max(...xs)).toBeCloseTo(box.right);
    expect(Math.min(...ys)).toBeCloseTo(box.bottom);
    expect(Math.max(...ys)).toBeCloseTo(box.top);
  });
});

describe('buildPrintPdf (D-1)', () => {
  async function doc(pages: number, opts: { rotate?: number; size?: [number, number] } = {}) {
    const d = await PDFDocument.create();
    for (let i = 0; i < pages; i++) {
      const page = d.addPage(opts.size ?? [600, 800]);
      page.drawText(`Seite ${i + 1}`, { x: 40, y: 40 });
      if (opts.rotate) page.setRotation(degrees(opts.rotate));
    }
    return d.save();
  }

  it('places every page on A4 and inserts blank pages for duplex', async () => {
    const { bytes, pageCount } = await buildPrintPdf([await doc(1), await doc(2, { size: [842, 595] }), await doc(3, { rotate: 90 })], true);
    expect(pageCount).toBe(1 + 1 + 2 + 3);
    const out = await PDFDocument.load(bytes);
    const sizes = out.getPages().map((p) => {
      const { width, height } = p.getSize();
      return width > height ? 'landscape' : 'portrait';
    });
    expect(sizes).toEqual(['portrait', 'portrait', 'landscape', 'landscape', 'landscape', 'landscape', 'landscape']);
    // output pages carry no rotation of their own
    expect(out.getPages().every((p) => p.getRotation().angle === 0)).toBe(true);
  });

  it('adds no blank pages without duplex', async () => {
    expect((await buildPrintPdf([await doc(1), await doc(1)], false)).pageCount).toBe(2);
  });
});
