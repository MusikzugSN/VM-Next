/** A parsed CSV file: header names, data rows and the line each row starts on (for messages). */
export interface CsvTable {
  headers: string[];
  rows: { line: number; cells: string[] }[];
  delimiter: ',' | ';' | '\t';
  encoding: 'utf-8' | 'windows-1252';
}

/** UTF-8 if the bytes are valid UTF-8 (BOM removed), otherwise Windows-1252 (old Excel exports). */
export function decodeCsv(bytes: ArrayBuffer): { text: string; encoding: CsvTable['encoding'] } {
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    // A byte order mark (U+FEFF, Excel) is not part of the first header name.
    return { text: text.charCodeAt(0) === 0xfeff ? text.slice(1) : text, encoding: 'utf-8' };
  } catch {
    return { text: new TextDecoder('windows-1252').decode(bytes), encoding: 'windows-1252' };
  }
}

/** The delimiter that occurs most often outside quotes in the header line. */
export function detectDelimiter(text: string): CsvTable['delimiter'] {
  const counts = { ',': 0, ';': 0, '\t': 0 };
  let quoted = false;
  for (const char of text) {
    if (char === '"') quoted = !quoted;
    else if (!quoted && (char === '\n' || char === '\r')) break;
    else if (!quoted && char in counts) counts[char as keyof typeof counts]++;
  }
  const best = (Object.entries(counts) as [CsvTable['delimiter'], number][]).sort((a, b) => b[1] - a[1])[0];
  return best[1] > 0 ? best[0] : ',';
}

/**
 * RFC 4180 parser: quoted cells may contain delimiters, line breaks and `""`. Empty lines are skipped,
 * short rows are padded to the header length. Header names are trimmed; empty ones become „Spalte n“.
 */
export function parseCsv(text: string, delimiter = detectDelimiter(text), encoding: CsvTable['encoding'] = 'utf-8'): CsvTable {
  const records: { line: number; cells: string[] }[] = [];
  let cells: string[] = [];
  let cell = '';
  let quoted = false;
  let line = 1;
  let start = 1;

  const endCell = () => {
    cells.push(cell);
    cell = '';
  };
  const endRow = () => {
    endCell();
    if (cells.some((c) => c.trim() !== '')) records.push({ line: start, cells });
    cells = [];
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        if (char === '\n') line++;
        cell += char;
      }
    } else if (char === '"' && cell === '') {
      quoted = true;
    } else if (char === delimiter) {
      endCell();
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      endRow();
      line++;
      start = line;
    } else {
      cell += char;
    }
  }
  if (cell !== '' || cells.length) endRow();

  const [header, ...rows] = records;
  const headers = (header?.cells ?? []).map((name, i) => name.trim() || `Spalte ${i + 1}`);
  return {
    headers,
    rows: rows.map((r) => ({ line: r.line, cells: headers.map((_, i) => r.cells[i] ?? '') })),
    delimiter,
    encoding,
  };
}

export async function readCsvFile(file: File): Promise<CsvTable> {
  const { text, encoding } = decodeCsv(await file.arrayBuffer());
  return parseCsv(text, detectDelimiter(text), encoding);
}
