import type { VoiceOptionsResponse } from '@vm-web/shared';

export type VoiceGroup = VoiceOptionsResponse['groups'][number];

/** Groups whose instrument or voice name contains the search text (case-insensitive). */
export function filterVoiceGroups(groups: readonly VoiceGroup[], search: string): VoiceGroup[] {
  const needle = search.trim().toLocaleLowerCase('de');
  if (!needle) return [...groups];
  return groups
    .map((group) =>
      group.instrument.name.toLocaleLowerCase('de').includes(needle)
        ? group
        : { ...group, voices: group.voices.filter((voice) => voice.name.toLocaleLowerCase('de').includes(needle)) },
    )
    .filter((group) => group.voices.length > 0);
}

/** Stand-in (M-2): at least one active voice is not one of the own profile voices. */
export function isStandIn(active: readonly { id: string }[], profile: readonly { id: string }[]): boolean {
  const own = new Set(profile.map((voice) => voice.id));
  return active.some((voice) => !own.has(voice.id));
}
