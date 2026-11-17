/**
 * Sort key for natural order of folder numbers (N-5): `2` < `10` < `10a` < `A3`.
 * Digit runs are left-padded to 10 digits, letters are lower-cased; compare keys with plain text order.
 */
export function naturalSortKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\d+/g, (digits) => digits.replace(/^0+(?=\d)/, '').padStart(10, '0'));
}

/** Compares two strings in natural order, consistent with `naturalSortKey`. */
export function compareNatural(a: string, b: string): number {
  const ka = naturalSortKey(a);
  const kb = naturalSortKey(b);
  return ka < kb ? -1 : ka > kb ? 1 : 0;
}
