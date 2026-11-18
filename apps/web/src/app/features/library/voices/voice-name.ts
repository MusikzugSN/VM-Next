/**
 * Instrument of a voice from its full name (N-6), so „Stimme anlegen“ needs one field only:
 * 1. the longest existing instrument contained in the name wins
 *    („Altsaxophon 1 in Es“ → „Saxophon“, „Flügelhorn 2“ → „Flügelhorn“, not „Horn“);
 * 2. otherwise the name without part number and key („Bassposaune 2 in C“ → „Bassposaune“).
 * Returns `''` for an empty name.
 */
export function instrumentFromVoiceName(voiceName: string, instruments: readonly string[]): string {
  const name = voiceName.trim();
  if (!name) return '';
  const lower = name.toLocaleLowerCase('de');
  const known = instruments
    .filter((instrument) => instrument.trim() && lower.includes(instrument.trim().toLocaleLowerCase('de')))
    .sort((a, b) => b.length - a.length)[0];
  if (known) return known;
  const stripped = name.replace(/\s+(\d+\.?|[IVX]+\.?|in\s+\S+)(\s.*)?$/i, '').trim();
  return stripped || name;
}
