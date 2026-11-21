import { PDFDocument } from 'pdf-lib';

import {
  firstSection,
  partFileName,
  removeSectionAt,
  sectionIndexAt,
  sectionRanges,
  splitPdf,
  startSectionAt,
  updateSection,
  uploadRanges,
} from './split-model';

describe('Sammel-PDF aufteilen (N-18)', () => {
  it('new sections take over the values of the section they split', () => {
    let sections = updateSection(firstSection(), 1, { scoreId: 's1', scoreTitle: 'Waldzauber', voiceId: 'tp1' });
    sections = startSectionAt(sections, 4);
    sections = updateSection(sections, 4, { voiceId: 'tp2' });
    sections = startSectionAt(sections, 3);
    expect(sections.map((s) => [s.start, s.scoreId, s.voiceId])).toEqual([
      [1, 's1', 'tp1'],
      [3, 's1', 'tp1'],
      [4, 's1', 'tp2'],
    ]);
    expect(sectionIndexAt(sections, 2)).toBe(0);
    expect(sectionIndexAt(sections, 9)).toBe(2);
  });

  it('a section after a skipped one is not skipped', () => {
    const sections = startSectionAt(updateSection(firstSection(), 1, { skip: true }), 2);
    expect(sections.map((s) => s.skip)).toEqual([true, false]);
  });

  it('does not create sections at page 1 or twice at the same page', () => {
    const sections = startSectionAt(startSectionAt(firstSection(), 1), 2);
    expect(startSectionAt(sections, 2)).toHaveLength(2);
    expect(sections).toHaveLength(2);
  });

  it('removing a boundary merges the pages into the previous section; the first stays', () => {
    const sections = startSectionAt(startSectionAt(firstSection(), 3), 5);
    expect(removeSectionAt(sections, 3).map((s) => s.start)).toEqual([1, 5]);
    expect(removeSectionAt(sections, 1).map((s) => s.start)).toEqual([1, 3, 5]);
  });

  it('computes page ranges and leaves skipped sections out of the upload', () => {
    let sections = startSectionAt(startSectionAt(firstSection(), 2), 6);
    sections = updateSection(sections, 1, { skip: true });
    expect(sectionRanges(sections, 7).map((r) => [r.from, r.to])).toEqual([
      [1, 1],
      [2, 5],
      [6, 7],
    ]);
    expect(uploadRanges(sections, 7).map((r) => [r.from, r.to])).toEqual([
      [2, 5],
      [6, 7],
    ]);
    expect(sectionRanges(sections, 4).map((r) => [r.from, r.to])).toEqual([
      [1, 1],
      [2, 4],
    ]);
  });

  it('names parts after the source file and the pages', () => {
    expect(partFileName('Sammlung.PDF', 3, 5)).toBe('Sammlung (S. 3–5).pdf');
    expect(partFileName('Sammlung.pdf', 2, 2)).toBe('Sammlung (S. 2).pdf');
  });

  it('copies the page ranges into separate PDFs', async () => {
    const doc = await PDFDocument.create();
    for (let i = 1; i <= 5; i++) doc.addPage([100 + i, 200]);
    const bytes = await doc.save();
    const parts = await splitPdf(bytes.buffer.slice(0) as ArrayBuffer, [
      { from: 1, to: 2 },
      { from: 5, to: 5 },
    ]);
    const loaded = await Promise.all(parts.map((p) => PDFDocument.load(p)));
    expect(loaded.map((d) => d.getPages().map((p) => p.getWidth()))).toEqual([[101, 102], [105]]);
  });
});
