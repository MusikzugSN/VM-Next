/** Replaces characters that are not allowed in file names and trims the result. */
export function safeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, ' ').trim();
}
