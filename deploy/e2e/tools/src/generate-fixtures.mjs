// Erzeugt aus fixtures/spec.json und den beiden CSVs die PDFs unter fixtures/generated/ und
// fixtures/expected.json (E-5). Deterministisch: gleiche Eingaben → gleiche Dateien.
//   node src/generate-fixtures.mjs [fixtures-dir]
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

import { layoutPrint, matchKey, pageLabel, readCsv, readJson, sheetFileName } from './lib.mjs';

const dir = resolve(process.argv[2] ?? '/e2e/fixtures');
const spec = readJson(join(dir, 'spec.json'));
const out = join(dir, 'generated');
const warnings = [];

// --- PDFs ------------------------------------------------------------------------------------------
const FIXED_DATE = new Date('2026-01-01T00:00:00Z');

async function pdf(pages) {
  const doc = await PDFDocument.create();
  doc.setCreationDate(FIXED_DATE);
  doc.setModificationDate(FIXED_DATE);
  doc.setProducer('vm-e2e fixtures');
  doc.setCreator('vm-e2e fixtures');
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  for (const p of pages) {
    const page = doc.addPage([595.28, 841.89]);
    page.drawText(p.heading, { x: 50, y: 760, size: 22, font: bold, color: rgb(0, 0, 0) });
    page.drawText(p.label, { x: 50, y: 720, size: 14, font });
    page.drawText('VM-E2E-FIXTURE', { x: 50, y: 40, size: 8, font, color: rgb(0.4, 0.4, 0.4) });
    // ein paar „Notenlinien“, damit Vorschau und Zuschneiden etwas zu sehen haben
    for (let s = 0; s < 8; s++) for (let l = 0; l < 5; l++) page.drawLine({ start: { x: 50, y: 640 - s * 70 - l * 7 }, end: { x: 545, y: 640 - s * 70 - l * 7 }, thickness: 0.6 });
  }
  return doc.save({ useObjectStreams: false });
}

function sheetPages(title, voice, pages, contentTitle = title) {
  return Array.from({ length: pages }, (_, i) => ({ heading: `${contentTitle} – ${voice}`, label: pageLabel(contentTitle, voice, i + 1, pages) }));
}

if (existsSync(out)) rmSync(out, { recursive: true });
mkdirSync(join(out, 'uploads'), { recursive: true });
mkdirSync(join(out, 'musician'), { recursive: true });

for (const s of spec.uploads.sheets) {
  writeFileSync(join(out, 'uploads', `${s.title} - ${s.voice}.pdf`), await pdf(sheetPages(s.title, s.voice, s.pages)));
}
const collectionPages = [];
if (spec.collection.cover) collectionPages.push({ heading: 'Sammelband (Deckblatt)', label: 'Deckblatt – nicht importieren' });
for (const s of spec.collection.sections) collectionPages.push(...sheetPages(s.title, s.voice, s.pages));
writeFileSync(join(out, spec.collection.file), await pdf(collectionPages));
for (const key of ['good', 'wrong', 'retry']) {
  const u = spec.musicianUploads[key];
  writeFileSync(join(out, 'musician', u.file), await pdf(sheetPages(u.title, u.voice, u.pages, u.contentTitle ?? u.title)));
}

// --- erwarteter Stand nach den CSV-Importen (N-19) ------------------------------------------------------
const scores = new Map(); // matchKey → [{ title, composer }]
const folderEntries = new Map(); // Mappenname → Map(matchKey(title) → number)
const imports = {};

for (const imp of spec.imports) {
  const path = join(dir, imp.file);
  if (!existsSync(path)) {
    warnings.push(`${imp.file} fehlt – Import ${imp.id} nicht berechnet`);
    continue;
  }
  const col = (target) => Object.entries(imp.mapping).find(([, t]) => t === target)?.[0];
  const { header, rows } = readCsv(path);
  for (const name of Object.keys(imp.mapping)) if (!header.includes(name)) warnings.push(`${imp.file}: Spalte „${name}“ fehlt`);
  const inFile = new Set();
  const stats = { rows: rows.length, create: 0, link: 0, mergedInFile: 0, errors: 0, folders: {} };
  for (const row of rows) {
    const title = row.get(col('title')).trim();
    const composer = row.get(col('composer') ?? '').trim();
    if (!title) {
      stats.errors++;
      continue;
    }
    const key = matchKey(title);
    const candidates = (scores.get(key) ?? []).filter((s) => !composer || !s.composer || matchKey(s.composer) === matchKey(composer));
    const match = candidates[0];
    if (!match) {
      const created = { title, composer, file: imp.id };
      scores.set(key, [...(scores.get(key) ?? []), created]);
      inFile.add(created);
      stats.create++;
    } else if (inFile.has(match)) stats.mergedInFile++;
    else {
      stats.link++;
      if (!match.composer && composer) match.composer = composer;
    }
    const folder = row.get(col('folder')).trim();
    if (folder) {
      stats.folders[folder] = (stats.folders[folder] ?? 0) + 1;
      if (!folderEntries.has(folder)) folderEntries.set(folder, new Map());
      const entries = folderEntries.get(folder);
      if (!entries.has(key)) entries.set(key, row.get(col('folder-number')).trim());
    }
  }
  stats.scoresAfter = [...scores.values()].reduce((n, l) => n + l.length, 0);
  imports[imp.id] = stats;
}

// --- Erwartungen an Downloads und Drucke -------------------------------------------------------------
const folder = folderEntries.get(spec.folder) ?? new Map();
const numberOf = (title) => {
  const n = folder.get(matchKey(title));
  if (n === undefined && folderEntries.size) warnings.push(`„${title}“ steht nicht in der Mappe „${spec.folder}“`);
  return n ?? null;
};
const sheetsOf = (voice) => spec.uploads.sheets.filter((s) => s.voice === voice);
const folderOrder = (list) => [...list].sort((a, b) => (numberOf(a.title) ?? '').localeCompare(numberOf(b.title) ?? '', 'de', { numeric: true }));

const trumpet = spec.voices['musiker-a'];
const folderZip = folderOrder(sheetsOf(trumpet)).map((s) => ({ name: sheetFileName({ number: numberOf(s.title), title: s.title, voice: s.voice }), title: s.title, voice: s.voice, pages: s.pages }));
const eventZip = spec.event.setlist
  .map((title, i) => ({ s: sheetsOf(trumpet).find((x) => x.title === title), position: String(i + 1).padStart(2, '0') }))
  .filter((e) => e.s)
  .map(({ s, position }) => ({ name: sheetFileName({ number: position, title: s.title, voice: s.voice }), title: s.title, voice: s.voice, pages: s.pages }));

const folderPrintDocs = folderOrder(sheetsOf(spec.printing.folderPrint.voice));
const folderLayout = layoutPrint(folderPrintDocs.map((s) => s.pages));
const folderPrint = {
  route: folderLayout.totalPages > spec.printing.pageLimit ? 'print-service' : 'browser',
  totalPages: folderLayout.totalPages,
  pages: folderLayout.slots.map((slot) => (slot.blank ? null : pageLabel(folderPrintDocs[slot.doc].title, folderPrintDocs[slot.doc].voice, slot.page, folderPrintDocs[slot.doc].pages))),
};
const pagesOf = (title, voice) => spec.uploads.sheets.find((s) => s.title === title && s.voice === voice)?.pages ?? spec.musicianUploads.good.pages;
const singlePrints = spec.printing.singlePrints.map((p) => {
  const pages = pagesOf(p.title, p.voice);
  const layout = layoutPrint([pages]);
  return { ...p, route: layout.totalPages > spec.printing.pageLimit ? 'print-service' : 'browser', totalPages: layout.totalPages, pages: layout.slots.map((s) => (s.blank ? null : pageLabel(p.title, p.voice, s.page, pages))) };
});
for (const p of singlePrints) if (p.route !== 'browser') warnings.push(`Einzeldruck ${p.title} läge über der Seitengrenze`);
if (folderPrint.route !== 'print-service') warnings.push('Mappendruck läge unter der Seitengrenze – Druckservice würde nicht getestet');

const scoresAfterImports = imports[spec.imports.at(-1).id]?.scoresAfter ?? null;
const expected = {
  $comment: 'Erzeugt von tools/src/generate-fixtures.mjs aus spec.json und den CSVs. Vor dem ersten Lauf von Hand gegenlesen (E-5).',
  imports,
  scores: { afterImports: scoresAfterImports, final: scoresAfterImports === null ? null : scoresAfterImports + 1 },
  folderNumbers: Object.fromEntries(spec.uploads.sheets.map((s) => [s.title, numberOf(s.title)])),
  sheets: {
    afterPhase3: spec.uploads.sheets.length + spec.collection.sections.length,
    final: spec.uploads.sheets.length + spec.collection.sections.length + 2,
  },
  uploads: { musicianFinal: { approved: 2, rejected: 1, pending: 0 } },
  downloads: { 'musiker-a': { folderZip, eventZip } },
  printing: { folderPrint, singlePrints },
  warnings,
};
writeFileSync(join(dir, 'expected.json'), `${JSON.stringify(expected, null, 2)}\n`);
console.log(`fixtures: ${spec.uploads.sheets.length} Einzel-PDFs, ${spec.collection.file}, 3 Musiker-PDFs, expected.json`);
for (const w of warnings) console.warn(`WARNUNG: ${w}`);
