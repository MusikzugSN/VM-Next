import { UPLOAD_MAX_PAGES, type PageTransform } from '@vm-web/shared';
import { degrees, EncryptedPDFError, PDFDocument } from 'pdf-lib';

export type PdfProblem = 'not_pdf' | 'encrypted' | 'damaged' | 'empty' | 'too_many_pages';

export class InvalidPdfError extends Error {
  constructor(readonly problem: PdfProblem) {
    super(`Invalid PDF: ${problem}`);
    this.name = 'InvalidPdfError';
  }
}

/** Checks magic bytes and that pdf-lib can read the file; returns the page count. */
export async function inspectPdf(bytes: Uint8Array): Promise<{ pageCount: number }> {
  const head = Buffer.from(bytes.subarray(0, 1024)).toString('latin1');
  if (!head.includes('%PDF-')) throw new InvalidPdfError('not_pdf');
  let pageCount: number;
  try {
    // pdf-lib parses broken files leniently and only fails when the page tree is accessed
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    pageCount = doc.getPageCount();
    if (pageCount <= UPLOAD_MAX_PAGES) doc.getPages();
  } catch (error) {
    throw new InvalidPdfError(error instanceof EncryptedPDFError ? 'encrypted' : 'damaged');
  }
  if (pageCount > UPLOAD_MAX_PAGES) throw new InvalidPdfError('too_many_pages');
  if (pageCount < 1) throw new InvalidPdfError('empty');
  return { pageCount };
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Converts a crop rectangle given relative to the page *as displayed* (after rotation,
 * origin top left, values 0..1) into PDF user space of the unrotated page (origin bottom left).
 * `rotation` is the total clockwise page rotation (0/90/180/270), `box` the page's visible box.
 */
export function cropToUserSpace(rotation: number, box: Box, crop: NonNullable<PageTransform['crop']>): Box {
  const { x, y } = crop;
  const w = Math.min(crop.width, 1 - x);
  const h = Math.min(crop.height, 1 - y);
  const W = box.width;
  const H = box.height;
  let r: Box;
  switch (((rotation % 360) + 360) % 360) {
    case 90: // displayed: dx = uy, dy = ux
      r = { x: y * W, y: x * H, width: h * W, height: w * H };
      break;
    case 180: // displayed: dx = W - ux, dy = uy
      r = { x: (1 - x - w) * W, y: y * H, width: w * W, height: h * H };
      break;
    case 270: // displayed: dx = H - uy, dy = W - ux
      r = { x: (1 - y - h) * W, y: (1 - x - w) * H, width: h * W, height: w * H };
      break;
    default: // displayed: dx = ux, dy = H - uy
      r = { x: x * W, y: (1 - y - h) * H, width: w * W, height: h * H };
  }
  return { x: box.x + r.x, y: box.y + r.y, width: r.width, height: r.height };
}

/**
 * Builds the sheet PDF from an upload (N-12): pages in the given order (pages may be left out
 * or repeated), each rotated and optionally cropped. The original stays untouched.
 */
export async function buildSheetPdf(source: Uint8Array, pages: readonly PageTransform[]): Promise<{ bytes: Uint8Array; pageCount: number }> {
  const src = await PDFDocument.load(source, { updateMetadata: false });
  const out = await PDFDocument.create();
  const copied = await out.copyPages(
    src,
    pages.map((p) => p.sourcePage - 1),
  );
  copied.forEach((page, i) => {
    const t = pages[i];
    const rotation = (page.getRotation().angle + t.rotation) % 360;
    out.addPage(page);
    page.setRotation(degrees(rotation));
    if (t.crop) {
      const c = cropToUserSpace(rotation, page.getCropBox(), t.crop);
      page.setCropBox(c.x, c.y, c.width, c.height);
    }
  });
  return { bytes: await out.save(), pageCount: copied.length };
}
