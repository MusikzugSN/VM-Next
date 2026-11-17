import { degrees, PDFDocument, type PDFPage } from 'pdf-lib';

/** A4 in PDF points and the 5 mm margin (D-1, F-8). */
export const A4 = { width: 595.28, height: 841.89 } as const;
export const MARGIN = (5 / 25.4) * 72;

/**
 * Blank pages after each document so that every score starts on a new sheet in duplex
 * printing (D-1, F-8): one blank page after an odd page count, none after the last document.
 */
export function blankPagesAfter(pageCounts: readonly number[], duplex: boolean): number[] {
  return pageCounts.map((pages, i) => (duplex && i < pageCounts.length - 1 && pages % 2 === 1 ? 1 : 0));
}

/** Browser print dialog up to the page limit, the local print service above it (D-2, D-3). */
export function printRoute(totalPages: number, pageLimit: number): 'browser' | 'print-service' {
  return totalPages <= pageLimit ? 'browser' : 'print-service';
}

export interface Placement {
  /** Output page size (A4 portrait or landscape, following the source page). */
  page: { width: number; height: number };
  x: number;
  y: number;
  scale: number;
  /** Counter-clockwise rotation for `drawPage`. */
  rotate: number;
}

/**
 * Where to draw a source page on A4 (D-1): the visible box (crop box) as displayed after the
 * page's own rotation, scaled to fit inside the margins and centred. Landscape pages go on A4
 * landscape so that they are not shrunk.
 */
export function placePage(box: { width: number; height: number }, rotation: number): Placement {
  const r = ((rotation % 360) + 360) % 360;
  const sideways = r === 90 || r === 270;
  const shown = sideways ? { width: box.height, height: box.width } : { width: box.width, height: box.height };
  const page = shown.width > shown.height ? { width: A4.height, height: A4.width } : { width: A4.width, height: A4.height };
  const scale = Math.min((page.width - 2 * MARGIN) / shown.width, (page.height - 2 * MARGIN) / shown.height);
  const X = (page.width - shown.width * scale) / 2;
  const Y = (page.height - shown.height * scale) / 2;
  const w = box.width * scale;
  const h = box.height * scale;
  // drawPage rotates around (x, y); move the origin so the rotated box lands on (X, Y)
  switch (r) {
    case 90:
      return { page, x: X, y: Y + w, scale, rotate: -90 };
    case 180:
      return { page, x: X + w, y: Y + h, scale, rotate: -180 };
    case 270:
      return { page, x: X + h, y: Y, scale, rotate: -270 };
    default:
      return { page, x: X, y: Y, scale, rotate: 0 };
  }
}

/**
 * Print-ready PDF (D-1): every page of every document placed on A4 with margins,
 * blank pages for duplex in between.
 */
export async function buildPrintPdf(documents: readonly Uint8Array[], duplex: boolean): Promise<{ bytes: Uint8Array; pageCount: number }> {
  const out = await PDFDocument.create();
  const sources = await Promise.all(documents.map((d) => PDFDocument.load(d, { updateMetadata: false })));
  const blanks = blankPagesAfter(
    sources.map((s) => s.getPageCount()),
    duplex,
  );

  for (const [i, src] of sources.entries()) {
    for (const srcPage of src.getPages()) placeOnA4(out, srcPage, await embed(out, srcPage));
    for (let b = 0; b < blanks[i]; b++) out.addPage([A4.width, A4.height]);
  }
  return { bytes: await out.save(), pageCount: out.getPageCount() };
}

async function embed(out: PDFDocument, page: PDFPage) {
  const crop = page.getCropBox();
  return out.embedPage(page, { left: crop.x, bottom: crop.y, right: crop.x + crop.width, top: crop.y + crop.height });
}

function placeOnA4(out: PDFDocument, srcPage: PDFPage, embedded: Awaited<ReturnType<PDFDocument['embedPage']>>): void {
  const crop = srcPage.getCropBox();
  const p = placePage(crop, srcPage.getRotation().angle);
  const page = out.addPage([p.page.width, p.page.height]);
  page.drawPage(embedded, { x: p.x, y: p.y, xScale: p.scale, yScale: p.scale, rotate: degrees(p.rotate) });
}
