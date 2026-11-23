/** A copy with `value` removed or added; a full set (`max`) stays unchanged when adding. */
export function toggled<T>(set: ReadonlySet<T>, value: T, max = Infinity): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else if (next.size < max) next.add(value);
  return next;
}

/** Same values, in any order. */
export function sameMembers<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): boolean {
  return a.size === b.size && [...b].every((value) => a.has(value));
}
