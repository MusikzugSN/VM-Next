/** Voice as candidate for the suggestion, in voice-list order (instrument, voice position). */
export interface VoiceCandidate {
  id: string;
  name: string;
}

/** Common abbreviations in file names → word as used in voice names (after `normalize`). */
const ABBREVIATIONS: Record<string, string> = {
  tp: 'trompete', trp: 'trompete', trpt: 'trompete', tromp: 'trompete', trumpet: 'trompete',
  flh: 'flugelhorn', flg: 'flugelhorn', flgh: 'flugelhorn', flhn: 'flugelhorn', flugel: 'flugelhorn',
  kl: 'klarinette', klar: 'klarinette', cl: 'klarinette', clar: 'klarinette', clarinet: 'klarinette',
  bkl: 'bassklarinette', bassklar: 'bassklarinette',
  pos: 'posaune', pos1: 'posaune', trb: 'posaune', trombone: 'posaune', bpos: 'bassposaune',
  hr: 'horn', hn: 'horn', hrn: 'horn',
  tenh: 'tenorhorn', th: 'tenorhorn', thn: 'tenorhorn',
  bar: 'bariton', bari: 'bariton', euph: 'bariton', euphonium: 'bariton',
  sax: 'saxophon', saxophone: 'saxophon',
  asax: 'altsaxophon', as: 'altsaxophon', tsax: 'tenorsaxophon', ts: 'tenorsaxophon', bsax: 'baritonsaxophon',
  fl: 'flote', flute: 'flote', picc: 'piccolo', ob: 'oboe', fg: 'fagott', fag: 'fagott', bassoon: 'fagott',
  tb: 'tuba', tub: 'tuba', kb: 'kontrabass', pk: 'pauken', pauke: 'pauken', timp: 'pauken',
  schlz: 'schlagzeug', sz: 'schlagzeug', drums: 'schlagzeug', perc: 'schlagzeug', mall: 'mallets', glsp: 'mallets',
};

/** Key names in file names → key as in voice names („in B“, „in Es“ …). */
const KEYS: Record<string, string> = { b: 'b', bb: 'b', es: 'es', eb: 'es', f: 'f', c: 'c', as: 'as', d: 'd' };

/** Lower case, umlauts and ß folded, „ue“/„oe“/„ae“ written out folded too. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ß/g, 'ss')
    .replace(/ae/g, 'a')
    .replace(/oe/g, 'o')
    .replace(/ue/g, 'u');
}

/** Tokens split at non-alphanumerics and at letter/digit boundaries: „Trp1in-Bb“ → trp, 1, in, bb. */
export function tokenize(text: string): string[] {
  return normalize(text)
    .replace(/\.pdf$/, '')
    .split(/[^a-z0-9]+|(?<=[a-z])(?=\d)|(?<=\d)(?=[a-z])/)
    .filter(Boolean);
}

interface ParsedVoice {
  keyword: string;
  number?: string;
  key?: string;
}

function parseVoice(name: string): ParsedVoice {
  const tokens = tokenize(name);
  const keyword = tokens.find((t) => /^[a-z]{2,}$/.test(t) && t !== 'in') ?? '';
  const number = tokens.find((t) => /^\d+$/.test(t));
  const inIndex = tokens.indexOf('in');
  const key = inIndex >= 0 ? KEYS[tokens[inIndex + 1] ?? ''] : undefined;
  return { keyword, number, key };
}

/** How specifically the file name names the voice's instrument word; 0 = not at all. */
function keywordScore(keyword: string, tokens: readonly string[]): number {
  if (!keyword) return 0;
  const expanded = tokens.map((t) => ABBREVIATIONS[t] ?? t);
  // two adjacent words that together form the keyword: „alt sax“ → altsaxophon
  for (let i = 0; i < expanded.length - 1; i++) {
    const pair = expanded[i] + expanded[i + 1];
    if (pair.length >= 6 && (keyword === pair || keyword.startsWith(pair) || pair.startsWith(keyword))) return 4;
  }
  if (expanded.includes(keyword)) return 3;
  // prefix like „klari“ or a longer token containing the keyword like „trompete1“
  if (expanded.some((t) => (t.length >= 4 && keyword.startsWith(t)) || (keyword.length >= 4 && t.startsWith(keyword)))) return 2;
  return 0;
}

/**
 * Proposes the voice of an uploaded file from its name (N-11). The user confirms before sending.
 * Instrument word required; the voice number must not contradict; the key adds confidence.
 * Ties go to the earlier voice in list order. `null` if nothing fits.
 */
export function suggestVoice(fileName: string, voices: readonly VoiceCandidate[]): VoiceCandidate | null {
  const tokens = tokenize(fileName);
  const numbers = new Set(tokens.filter((t) => /^\d{1,2}$/.test(t)));
  const keys = new Set(tokens.filter((t) => t in KEYS).map((t) => KEYS[t]));

  let best: { voice: VoiceCandidate; score: number } | null = null;
  for (const voice of voices) {
    const parsed = parseVoice(voice.name);
    const base = keywordScore(parsed.keyword, tokens);
    if (!base) continue;
    let score = base * 10;
    if (parsed.number) {
      if (numbers.has(parsed.number)) score += 5;
      else if (numbers.size) continue; // file names another number
    } else if (numbers.size) {
      score -= 1;
    }
    if (parsed.key) {
      if (keys.has(parsed.key)) score += 3;
      else if (keys.size) score -= 3;
    }
    if (!best || score > best.score) best = { voice, score };
  }
  return best?.voice ?? null;
}
