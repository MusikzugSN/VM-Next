import type { VoiceRef } from '@vm-web/shared';
import { defaultPageCount, relevantVoiceIds, resolveSheets, sheetsForOutput, type SheetRow, type VoiceSelection } from './sheet-resolution';

const v = (id: string): VoiceRef => ({ id, name: id, instrumentId: 'i' });
const TP1 = v('tp1');
const TP2 = v('tp2');
const FLH1 = v('flh1');
const HN_F = v('hn-f');
const HN_ES = v('hn-es');
const sheet = (voice: VoiceRef, pageCount = 2): SheetRow => ({ sheetId: `sheet-${voice.id}`, voiceId: voice.id, pageCount });

const selection = (active: VoiceRef[], subs: Record<string, VoiceRef[]> = {}): VoiceSelection => ({
  active,
  substitutesOf: new Map(Object.entries(subs)),
});

describe('resolveSheets (M-2, M-3, N-9)', () => {
  it('shows the own sheet', () => {
    const r = resolveSheets(selection([TP1]), [sheet(TP1), sheet(TP2)]);
    expect(r.availability).toBe('available');
    expect(r.sheets).toEqual([{ sheetId: 'sheet-tp1', voice: TP1, pageCount: 2, kind: 'own', substituteFor: null }]);
    expect(r.missingVoices).toEqual([]);
  });

  it('always adds substitutes after own sheets, marked (M-3)', () => {
    const r = resolveSheets(selection([TP1], { tp1: [FLH1] }), [sheet(FLH1), sheet(TP1)]);
    expect(r.sheets.map((s) => [s.voice.id, s.kind, s.substituteFor?.id ?? null])).toEqual([
      ['tp1', 'own', null],
      ['flh1', 'substitute', 'tp1'],
    ]);
  });

  it('keeps substitute order and reports substitute-only availability', () => {
    const r = resolveSheets(selection([HN_F], { 'hn-f': [HN_ES, FLH1] }), [sheet(FLH1), sheet(HN_ES)]);
    expect(r.availability).toBe('substitute-only');
    expect(r.sheets.map((s) => s.voice.id)).toEqual(['hn-es', 'flh1']);
    expect(r.missingVoices).toEqual([HN_F]);
  });

  it('reports „Stimme fehlt“ when neither own voice nor substitutes exist', () => {
    const r = resolveSheets(selection([TP1], { tp1: [FLH1] }), [sheet(TP2)]);
    expect(r).toEqual({ availability: 'missing', sheets: [], missingVoices: [TP1] });
  });

  it('handles several active voices: own sheets in voice order, then substitutes', () => {
    const r = resolveSheets(selection([TP2, FLH1], { tp2: [TP1] }), [sheet(TP1), sheet(FLH1)]);
    expect(r.sheets.map((s) => [s.voice.id, s.kind])).toEqual([
      ['flh1', 'own'],
      ['tp1', 'substitute'],
    ]);
    expect(r.missingVoices).toEqual([TP2]);
    expect(r.availability).toBe('available');
  });

  it('never shows an active voice as substitute and no sheet twice', () => {
    // tp1 is active and also substitute of tp2; flh1 is substitute of both
    const r = resolveSheets(selection([TP1, TP2], { tp1: [FLH1], tp2: [TP1, FLH1] }), [sheet(TP1), sheet(FLH1)]);
    expect(r.sheets.map((s) => [s.voice.id, s.kind, s.substituteFor?.id ?? null])).toEqual([
      ['tp1', 'own', null],
      ['flh1', 'substitute', 'tp1'],
    ]);
  });

  it('returns nothing without active voices (no profile voices yet, M-1)', () => {
    expect(resolveSheets(selection([]), [sheet(TP1)])).toEqual({ availability: 'missing', sheets: [], missingVoices: [] });
  });

  it('collects all relevant voice ids for loading', () => {
    expect(relevantVoiceIds(selection([TP1, TP2], { tp1: [FLH1], tp2: [TP1] })).sort()).toEqual(['flh1', 'tp1', 'tp2']);
  });
});

describe('sheetsForOutput (F-7)', () => {
  const r = resolveSheets(selection([TP1, HN_F], { tp1: [FLH1], 'hn-f': [HN_ES, FLH1] }), [
    sheet(TP1, 1),
    sheet(FLH1, 2),
    sheet(HN_ES, 3),
  ]);

  it('fallback: own sheets plus the first substitute of voices without own sheet', () => {
    expect(sheetsForOutput(r, 'fallback').map((s) => s.voice.id)).toEqual(['tp1', 'hn-es']);
    expect(defaultPageCount(r)).toBe(4);
  });

  it('all: everything shown; none: own only', () => {
    expect(sheetsForOutput(r, 'all').map((s) => s.voice.id)).toEqual(['tp1', 'flh1', 'hn-es']);
    expect(sheetsForOutput(r, 'none').map((s) => s.voice.id)).toEqual(['tp1']);
  });
});
