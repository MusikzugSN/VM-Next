// Gemeinsame Helfer für Fixture-Generator und Orakel.
import { readFileSync } from 'node:fs';

/** Wie apps/api/src/scores/score-import-values.ts `matchKey`: Titelvergleich beim CSV-Import (N-19). */
export function matchKey(value) {
  return (value ?? '').normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('de');
}

/** Wie apps/api/src/common/files/download-names.ts. */
export function sanitizeFileName(name) {
  const cleaned = name
    .normalize('NFC')
    // eslint-disable-next-line no-control-regex
    .replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '');
  return cleaned || 'Dokument';
}

/** „Nr – Titel – Stimme.pdf“ (M-6). */
export function sheetFileName({ number, title, voice }) {
  return `${[number, title, voice].filter((p) => p && p.trim()).map(sanitizeFileName).join(' – ')}.pdf`;
}

/** Wie apps/api/src/downloads/print-layout.ts `layoutDocuments` mit den Standard-Druckregeln (1 Seite simplex, sonst duplex). */
export function layoutPrint(pageCounts) {
  const modes = pageCounts.map((p) => (p >= 2 ? 'duplex' : 'simplex'));
  const duplex = modes.includes('duplex');
  const slots = [];
  pageCounts.forEach((pages, i) => {
    const last = i === pageCounts.length - 1;
    const doc = [];
    if (!duplex) for (let p = 0; p < pages; p++) doc.push({ page: p + 1 });
    else if (modes[i] === 'duplex') {
      for (let p = 0; p < pages; p++) doc.push({ page: p + 1 });
      if (pages % 2 === 1 && !last) doc.push('blank');
    } else {
      for (let p = 0; p < pages; p++) {
        doc.push({ page: p + 1 });
        if (!(last && p === pages - 1)) doc.push('blank');
      }
    }
    slots.push(...doc.map((s) => (s === 'blank' ? { blank: true } : { doc: i, page: s.page })));
  });
  return { duplex, slots, totalPages: slots.length };
}

/** CSV wie im Import (N-19): UTF-8 oder Windows-1252, Trennzeichen , oder ; automatisch. */
export function readCsv(path) {
  const bytes = readFileSync(path);
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    text = new TextDecoder('windows-1252').decode(bytes);
  }
  text = text.replace(/^﻿/, '');
  const firstLine = text.slice(0, text.search(/\r?\n/) >>> 0);
  const delimiter = (firstLine.match(/;/g) ?? []).length > (firstLine.match(/,/g) ?? []).length ? ';' : ',';
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === delimiter) {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...data] = rows.filter((r) => r.some((f) => f.trim() !== ''));
  return { header, rows: data.map((r, i) => ({ line: i + 2, get: (name) => r[header.indexOf(name)] ?? '' })) };
}

export function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** Text auf jeder Fixture-Seite; das Orakel erkennt Seiten daran. */
export function pageLabel(title, voice, page, pages) {
  return `${title} · ${voice} · Seite ${page}/${pages}`;
}
