/**
 * Values from outside (profile pictures, links) are passed on only as well-formed http(s) URLs;
 * anything else (e.g. `javascript:`) becomes `null`.
 */
export function httpUrlOrNull(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}
