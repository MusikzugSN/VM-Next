import type { VoiceOptionsResponse } from '@vm-web/shared';

export type VoiceGroup = VoiceOptionsResponse['groups'][number];

/** Groups whose instrument or voice name contains the search text (case-insensitive). */
export function filterVoiceGroups(groups: readonly VoiceGroup[], search: string): VoiceGroup[] {
  return filterGroups<VoiceGroup['voices'][number], VoiceGroup>(groups, search, (voice, hit) => hit(voice.name));
}

/**
 * Keeps whole groups whose instrument matches; other groups keep only their matching voices.
 * Comparison is case-insensitive; an empty search keeps everything.
 */
export function filterGroups<V, G extends { instrument: { name: string }; voices: readonly V[] }>(
  groups: readonly G[],
  search: string,
  voiceMatches: (voice: V, hit: (text: string) => boolean) => boolean,
): G[] {
  const needle = search.trim().toLocaleLowerCase('de');
  if (!needle) return [...groups];
  const hit = (text: string) => text.toLocaleLowerCase('de').includes(needle);
  return groups
    .map((group) => (hit(group.instrument.name) ? group : { ...group, voices: group.voices.filter((voice) => voiceMatches(voice, hit)) }))
    .filter((group) => group.voices.length > 0);
}

/** Stand-in (M-2): at least one active voice is not one of the own profile voices. */
export function isStandIn(active: readonly { id: string }[], profile: readonly { id: string }[]): boolean {
  const own = new Set(profile.map((voice) => voice.id));
  return active.some((voice) => !own.has(voice.id));
}
