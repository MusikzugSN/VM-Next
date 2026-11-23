/**
 * The strings of a stored JSON list; anything else counts as empty. The storage is passed as a
 * function because merely accessing it throws when the browser blocks it.
 */
export function readStoredStrings(storage: () => Storage, key: string): string[] {
  try {
    const raw = storage().getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

/** Runs a storage write; when the browser blocks it, the value is simply not remembered. */
export function ignoreStorageErrors(write: () => void): void {
  try {
    write();
  } catch {
    // Storage blocked or full.
  }
}
