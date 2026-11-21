import type { PrintMode } from '@vm-web/shared';
import { degrees, PDFDocument, type PDFPage } from 'pdf-lib';

/** A4 in PDF points and the 5 mm margin (D-1, F-8). */
export const A4 = { width: 595.28, height: 841.89 } as const;
export const MARGIN = (5 / 25.4) * 72;

/** Page sequence of one score in the print-ready PDF. */
export interface DocumentLayout {
  mode: PrintMode;
  /** Source pages and blank pages in output order. */
  slots: ('page' | 'blank')[];
  blanks: number;
  sheets: number;
}

/**
 * Lays out the scores of a job by their print rules (D-1, D-6, F-8). The job is printed on both
 * sides as soon as one score is `duplex`; then
 * - a `duplex` score gets a blank page after an odd page count, so the next score starts on a new sheet;
 * - a `simplex` score gets a blank back page after every page.
 * Without any duplex score, nothing is inserted. No blank page after the very last page.
 */
export function layoutDocuments(pageCounts: readonly number[], modes: readonly PrintMode[]): { duplex: boolean; documents: DocumentLayout[]; totalPages: number } {
  const duplex = modes.includes('duplex');
  const documents = pageCounts.map((pages, i): DocumentLayout => {
    const mode = modes[i] ?? 'duplex';
    const last = i === pageCounts.length - 1;
    const slots: ('page' | 'blank')[] = [];
    if (!duplex) {
      for (let p = 0; p < pages; p++) slots.push('page');
      return { mode, slots, blanks: 0, sheets: pages };
    }
    if (mode === 'duplex') {
      for (let p = 0; p < pages; p++) slots.push('page');
      if (pages % 2 === 1 && !last) slots.push('blank');
      return { mode, slots, blanks: slots.length - pages, sheets: Math.ceil(pages / 2) };
    }
    for (let p = 0; p < pages; p++) {
      slots.push('page');
      if (!(last && p === pages - 1)) slots.push('blank');
    }
    return { mode, slots, blanks: slots.length - pages, sheets: pages };
  });
  return { duplex, documents, totalPages: documents.reduce((sum, d) => sum + d.slots.length, 0) };
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
 * Print-ready PDF (D-1): every page of every document placed on A4 with margins, blank pages
 * as the print rules require (`layoutDocuments`, D-6).
 */
export async function buildPrintPdf(documents: readonly Uint8Array[], modes: readonly PrintMode[]): Promise<{ bytes: Uint8Array; pageCount: number; duplex: boolean }> {
  const out = await PDFDocument.create();
  const sources = await Promise.all(documents.map((d) => PDFDocument.load(d, { updateMetadata: false })));
  const layout = layoutDocuments(
    sources.map((s) => s.getPageCount()),
    modes,
  );

  for (const [i, src] of sources.entries()) {
    const pages = src.getPages();
    let next = 0;
    for (const slot of layout.documents[i].slots) {
      if (slot === 'blank') {
        out.addPage([A4.width, A4.height]);
        continue;
      }
      const srcPage = pages[next++];
      placeOnA4(out, srcPage, await embed(out, srcPage));
    }
  }
  return { bytes: await out.save(), pageCount: out.getPageCount(), duplex: layout.duplex };
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
