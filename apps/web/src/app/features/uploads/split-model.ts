/**
 * Splitting a collective PDF (N-18): a section starts at a page and runs until the next section.
 * Each section is a score + voice or is skipped (e.g. cover pages). Pages are 1-based.
 */
export interface SplitSection {
  start: number;
  skip: boolean;
  scoreId: string | null;
  scoreTitle: string | null;
  voiceId: string | null;
}

export interface SplitRange {
  section: SplitSection;
  from: number;
  to: number;
}

export function firstSection(preset: { scoreId?: string; scoreTitle?: string; voiceId?: string } = {}): SplitSection[] {
  return [{ start: 1, skip: false, scoreId: preset.scoreId ?? null, scoreTitle: preset.scoreTitle ?? null, voiceId: preset.voiceId ?? null }];
}

/** Index of the section that contains the page. */
export function sectionIndexAt(sections: readonly SplitSection[], page: number): number {
  let index = 0;
  sections.forEach((s, i) => {
    if (s.start <= page) index = i;
  });
  return index;
}

/**
 * Starts a new section at the page, taking over score and voice of the section it splits
 * („die Werte gelten bis zur nächsten Änderung“), but never „skip“ (a cover page is not followed by
 * more cover pages). No-op if a section already starts there.
 */
export function startSectionAt(sections: readonly SplitSection[], page: number): SplitSection[] {
  if (page <= 1 || sections.some((s) => s.start === page)) return [...sections];
  const current = sections[sectionIndexAt(sections, page)];
  return [...sections, { ...current, start: page, skip: false }].sort((a, b) => a.start - b.start);
}

/** Removes the section boundary at the page; its pages join the previous section. The first section stays. */
export function removeSectionAt(sections: readonly SplitSection[], page: number): SplitSection[] {
  return sections.filter((s) => s.start === 1 || s.start !== page);
}

export function updateSection(sections: readonly SplitSection[], start: number, patch: Partial<Omit<SplitSection, 'start'>>): SplitSection[] {
  return sections.map((s) => (s.start === start ? { ...s, ...patch } : s));
}

/** Page ranges of all sections within the document. */
export function sectionRanges(sections: readonly SplitSection[], pageCount: number): SplitRange[] {
  const inside = sections.filter((s) => s.start <= pageCount);
  return inside.map((section, i) => ({ section, from: section.start, to: (inside[i + 1]?.start ?? pageCount + 1) - 1 }));
}

/** Ranges that become uploads (not skipped). */
export function uploadRanges(sections: readonly SplitSection[], pageCount: number): SplitRange[] {
  return sectionRanges(sections, pageCount).filter((r) => !r.section.skip);
}

/** „Sammlung (S. 3–5).pdf“ – file name of a part, also shown in the upload list and review. */
export function partFileName(fileName: string, from: number, to: number): string {
  const base = fileName.replace(/\.pdf$/i, '').slice(0, 200);
  const pages = from === to ? `S. ${from}` : `S. ${from}–${to}`;
  return `${base} (${pages}).pdf`;
}

/** Copies the page ranges into new PDFs with pdf-lib (loaded on first use). */
export async function splitPdf(bytes: ArrayBuffer, ranges: readonly { from: number; to: number }[]): Promise<Uint8Array[]> {
  const { PDFDocument } = await import('pdf-lib');
  const source = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const parts: Uint8Array[] = [];
  for (const range of ranges) {
    const part = await PDFDocument.create();
    const indices = Array.from({ length: range.to - range.from + 1 }, (_, i) => range.from - 1 + i);
    for (const page of await part.copyPages(source, indices)) part.addPage(page);
    parts.push(await part.save());
  }
  return parts;
}
