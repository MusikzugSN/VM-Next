import { addFiles, fileProblem, formatSize, sendable, uploadMeta, UPLOAD_MAX_FILE_BYTES } from '../../uploads/upload-model';
import { clampCrop, initialPages, isTypingTarget, rotate, toTransforms } from './review-model';

const pdf = (name: string, size = 1000) => {
  const file = new File(['x'], name, { type: 'application/pdf', lastModified: 1 });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

describe('upload dialog (N-11)', () => {
  it('flags non-PDFs and too large files', () => {
    expect(fileProblem(pdf('a.pdf'))).toBeNull();
    expect(fileProblem(new File(['x'], 'scan.PDF'))).toBeNull();
    expect(fileProblem(new File(['x'], 'bild.png', { type: 'image/png' }))).toBe('not-pdf');
    expect(fileProblem(pdf('big.pdf', UPLOAD_MAX_FILE_BYTES + 1))).toBe('too-large');
  });

  it('adds files once, applies the preset and builds the meta part', () => {
    const preset = { scoreId: 's1', scoreTitle: 'Abba Gold' };
    let items = addFiles([], [pdf('Abba Gold – Trompete 2 in B.pdf'), new File(['x'], 'notiz.txt')], preset);
    items = addFiles(items, [pdf('Abba Gold – Trompete 2 in B.pdf')], preset);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ scoreId: 's1', scoreTitle: 'Abba Gold', voiceId: null, problem: null });
    expect(sendable(items)).toHaveLength(1);
    expect(uploadMeta(sendable(items))).toEqual({ items: [{ fileName: 'Abba Gold – Trompete 2 in B.pdf', scoreId: 's1', voiceId: null }] });
  });

  it('stops at 50 files', () => {
    const files = Array.from({ length: 60 }, (_, i) => pdf(`f${i}.pdf`));
    expect(addFiles([], files, {})).toHaveLength(50);
  });

  it('formats sizes in German', () => {
    expect(formatSize(900)).toBe('1 KB');
    expect(formatSize(1.25 * 1024 * 1024)).toBe('1,3 MB');
  });
});

describe('review (N-12)', () => {
  it('rotates in steps of 90 degrees', () => {
    expect(rotate(0)).toBe(90);
    expect(rotate(270)).toBe(0);
  });

  it('keeps at least 10 % of the page when cropping', () => {
    expect(clampCrop({ left: 60, top: -5, right: 60, bottom: 200 })).toEqual({ left: 60, top: 0, right: 30, bottom: 90 });
    expect(clampCrop({ left: Number.NaN, top: 5, right: 5, bottom: 5 })).toEqual({ left: 0, top: 5, right: 5, bottom: 5 });
  });

  it('turns page states into API transforms and leaves out removed pages', () => {
    const pages = initialPages(3);
    pages[0] = { ...pages[0], rotation: 90, crop: { left: 10, top: 5, right: 0, bottom: 15 } };
    pages[1] = { ...pages[1], keep: false };
    pages[2] = { ...pages[2], crop: { left: 0, top: 0, right: 0, bottom: 0 } };
    expect(toTransforms(pages)).toEqual([
      { sourcePage: 1, rotation: 90, crop: { x: 0.1, y: 0.05, width: 0.9, height: 0.8 } },
      { sourcePage: 3, rotation: 0, crop: null },
    ]);
  });

  it('ignores shortcuts while typing (N-13)', () => {
    expect(isTypingTarget(document.createElement('textarea'))).toBe(true);
    expect(isTypingTarget(document.createElement('select'))).toBe(true);
    expect(isTypingTarget(document.createElement('button'))).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});
