import type { PageTransform } from '@vm-web/shared';

export type Rotation = PageTransform['rotation'];

/** Crop as margins in percent of the displayed (rotated) page: easy to type, easy to show. */
export interface CropMargins {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Edit state of one page of an upload (N-12). */
export interface PageState {
  sourcePage: number;
  rotation: Rotation;
  crop: CropMargins | null;
  /** Pages switched off are left out of the sheet (e.g. an empty back side). */
  keep: boolean;
}

export const NO_CROP: CropMargins = { left: 0, top: 0, right: 0, bottom: 0 };
/** Smallest remaining width/height of a crop in percent. */
export const MIN_CROP_SIZE = 10;

export function initialPages(count: number): PageState[] {
  return Array.from({ length: count }, (_, i) => ({ sourcePage: i + 1, rotation: 0, crop: null, keep: true }));
}

export function rotate(rotation: Rotation): Rotation {
  return ((rotation + 90) % 360) as Rotation;
}

/** Clamps margins to 0..100 and keeps at least `MIN_CROP_SIZE` percent of the page. */
export function clampCrop(crop: CropMargins): CropMargins {
  const c = (v: number) => Math.min(100, Math.max(0, Number.isFinite(v) ? v : 0));
  let { left, top, right, bottom } = { left: c(crop.left), top: c(crop.top), right: c(crop.right), bottom: c(crop.bottom) };
  if (left + right > 100 - MIN_CROP_SIZE) right = Math.max(0, 100 - MIN_CROP_SIZE - left);
  if (top + bottom > 100 - MIN_CROP_SIZE) bottom = Math.max(0, 100 - MIN_CROP_SIZE - top);
  left = Math.min(left, 100 - MIN_CROP_SIZE);
  top = Math.min(top, 100 - MIN_CROP_SIZE);
  return { left, top, right, bottom };
}

export function isNoCrop(crop: CropMargins | null): boolean {
  return !crop || (crop.left === 0 && crop.top === 0 && crop.right === 0 && crop.bottom === 0);
}

/** API transform (relative rectangle 0..1 on the displayed page) for the pages to keep. */
export function toTransforms(pages: readonly PageState[]): PageTransform[] {
  return pages
    .filter((page) => page.keep)
    .map((page) => {
      const crop = page.crop && !isNoCrop(page.crop) ? page.crop : null;
      return {
        sourcePage: page.sourcePage,
        rotation: page.rotation,
        crop: crop
          ? {
              x: round(crop.left / 100),
              y: round(crop.top / 100),
              width: round((100 - crop.left - crop.right) / 100),
              height: round((100 - crop.top - crop.bottom) / 100),
            }
          : null,
      };
    });
}

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

/** Keyboard shortcuts of the review (N-13) only act when no form field has the focus. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}
