import type { CompletenessSummary, VoiceRef } from '@vm-web/shared';

export interface CompletenessVoice {
  voice: VoiceRef;
  status: 'present' | 'substituted' | 'missing';
  sheetId: string | null;
  substitute: VoiceRef | null;
}

/**
 * Completeness of one score against the lineup of an ensemble (N-4, N-9, F-5):
 * `present` = own sheet, `substituted` = only the first available substitute has a sheet
 * (counted separately, not as present), `missing` otherwise.
 */
export function completenessOf(
  lineup: readonly VoiceRef[],
  substitutesOf: ReadonlyMap<string, readonly VoiceRef[]>,
  sheetByVoice: ReadonlyMap<string, string>,
): { summary: CompletenessSummary; voices: CompletenessVoice[] } {
  const voices = lineup.map((voice): CompletenessVoice => {
    const own = sheetByVoice.get(voice.id);
    if (own) return { voice, status: 'present', sheetId: own, substitute: null };
    const substitute = (substitutesOf.get(voice.id) ?? []).find((s) => sheetByVoice.has(s.id));
    return substitute
      ? { voice, status: 'substituted', sheetId: sheetByVoice.get(substitute.id) ?? null, substitute }
      : { voice, status: 'missing', sheetId: null, substitute: null };
  });
  return {
    summary: {
      present: voices.filter((v) => v.status === 'present').length,
      substituted: voices.filter((v) => v.status === 'substituted').length,
      total: lineup.length,
    },
    voices,
  };
}
