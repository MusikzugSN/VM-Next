import type { MemberSheet, SheetAvailability, SubstituteMode, VoiceRef } from '@vm-web/shared';

/** Approved sheet of one score, as loaded from the database. */
export interface SheetRow {
  sheetId: string;
  voiceId: string;
  pageCount: number;
}

/** Active voices (profile or temporary switch, M-2) with their ordered substitutes (N-9). */
export interface VoiceSelection {
  active: readonly VoiceRef[];
  substitutesOf: ReadonlyMap<string, readonly VoiceRef[]>;
}

export interface ResolvedSheets {
  availability: SheetAvailability;
  /** Own sheets in order of the active voices, then substitutes in substitute order (M-3). */
  sheets: MemberSheet[];
  /** Active voices without own sheet (M-9). */
  missingVoices: VoiceRef[];
}

/** All voice ids whose sheets may be shown for a selection. */
export function relevantVoiceIds(selection: VoiceSelection): string[] {
  const ids = new Set(selection.active.map((v) => v.id));
  for (const subs of selection.substitutesOf.values()) subs.forEach((v) => ids.add(v.id));
  return [...ids];
}

/**
 * Which sheets of a score a member sees (M-2, M-3, N-9):
 * - own sheets of every active voice,
 * - always additionally the substitutes of every active voice, ranked lower and marked,
 * - a voice that is itself active never appears as substitute, and no sheet appears twice.
 */
export function resolveSheets(selection: VoiceSelection, sheetsOfScore: readonly SheetRow[]): ResolvedSheets {
  const byVoice = new Map(sheetsOfScore.map((s) => [s.voiceId, s]));
  const activeIds = new Set(selection.active.map((v) => v.id));
  const own: MemberSheet[] = [];
  const substitutes: MemberSheet[] = [];
  const missingVoices: VoiceRef[] = [];
  const used = new Set<string>();

  for (const voice of selection.active) {
    const sheet = byVoice.get(voice.id);
    if (sheet) {
      own.push({ sheetId: sheet.sheetId, voice, pageCount: sheet.pageCount, kind: 'own', substituteFor: null });
      used.add(sheet.sheetId);
    } else {
      missingVoices.push(voice);
    }
  }

  for (const voice of selection.active) {
    for (const sub of selection.substitutesOf.get(voice.id) ?? []) {
      const sheet = byVoice.get(sub.id);
      if (!sheet || activeIds.has(sub.id) || used.has(sheet.sheetId)) continue;
      substitutes.push({ sheetId: sheet.sheetId, voice: sub, pageCount: sheet.pageCount, kind: 'substitute', substituteFor: voice });
      used.add(sheet.sheetId);
    }
  }

  const availability: SheetAvailability = own.length ? 'available' : substitutes.length ? 'substitute-only' : 'missing';
  return { availability, sheets: [...own, ...substitutes], missingVoices };
}

/**
 * Sheets that go into a ZIP or print document (F-7):
 * `fallback` = own sheets, plus for each active voice without own sheet its first available substitute;
 * `all` = everything `resolveSheets` shows; `none` = own sheets only.
 */
export function sheetsForOutput(resolved: ResolvedSheets, mode: SubstituteMode): MemberSheet[] {
  const own = resolved.sheets.filter((s) => s.kind === 'own');
  if (mode === 'none') return own;
  if (mode === 'all') return resolved.sheets;
  const fallback: MemberSheet[] = [];
  for (const voice of resolved.missingVoices) {
    const first = resolved.sheets.find((s) => s.kind === 'substitute' && s.substituteFor?.id === voice.id);
    if (first && !fallback.includes(first)) fallback.push(first);
  }
  return [...own, ...fallback];
}

/** Pages printed in the default mode – used for the page counters in folder/event headers. */
export function defaultPageCount(resolved: ResolvedSheets): number {
  return sheetsForOutput(resolved, 'fallback').reduce((sum, s) => sum + s.pageCount, 0);
}
