import { apiUrl } from '@vm-web/shared';

import { toParams, type ApiQuery } from './api-client';

/** Adds a query string to a URL; empty values are left out. */
export function withQuery(url: string, query: ApiQuery): string {
  const qs = toParams(query).toString();
  return qs ? `${url}?${qs}` : url;
}

/** PDF of a sheet (M-6): `inline` for the preview, otherwise download with „Nr – Titel – Stimme.pdf“. */
export function sheetPdfUrl(sheetId: string, options: { folderId?: string | null; inline?: boolean } = {}): string {
  return withQuery(apiUrl('me', 'sheetPdf', { sheetId }), {
    folderId: options.folderId ?? undefined,
    disposition: options.inline ? 'inline' : undefined,
  });
}

/** ZIP of a folder or event with the active voices (M-6); substitutes only where the own voice is missing. */
export function folderZipUrl(folderId: string, voiceIds: readonly string[]): string {
  return withQuery(apiUrl('me', 'folderZip', { folderId }), { voiceId: voiceIds });
}

export function eventZipUrl(eventId: string, voiceIds: readonly string[]): string {
  return withQuery(apiUrl('me', 'eventZip', { eventId }), { voiceId: voiceIds });
}
