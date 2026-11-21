import { UPLOAD_MAX_FILES, type UploadSheetsMeta } from '@vm-web/shared';

/** Same limit as the API default (`UPLOAD_MAX_FILE_MB`). */
export const UPLOAD_MAX_FILE_BYTES = 50 * 1024 * 1024;

export type UploadFileProblem = 'not-pdf' | 'too-large';

/** One file in the upload dialog with its assignment (N-11). */
export interface UploadItem {
  key: string;
  file: File;
  scoreId: string | null;
  scoreTitle: string | null;
  voiceId: string | null;
  /** The voice was proposed from the file name and not changed yet. */
  suggested: boolean;
  problem: UploadFileProblem | null;
}

export function fileProblem(file: File): UploadFileProblem | null {
  const pdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!pdf) return 'not-pdf';
  if (file.size > UPLOAD_MAX_FILE_BYTES) return 'too-large';
  return null;
}

/**
 * Adds chosen or dropped files: skips files already in the list (same name and size), checks type
 * and size, applies the preselected score, stops at the API limit of 50 files.
 */
export function addFiles(
  current: readonly UploadItem[],
  files: readonly File[],
  preset: { scoreId?: string; scoreTitle?: string; voiceId?: string },
): UploadItem[] {
  const result = [...current];
  for (const file of files) {
    if (result.length >= UPLOAD_MAX_FILES) break;
    if (result.some((item) => item.file.name === file.name && item.file.size === file.size)) continue;
    result.push({
      key: `${file.name}-${file.size}-${file.lastModified}`,
      file,
      scoreId: preset.scoreId ?? null,
      scoreTitle: preset.scoreTitle ?? null,
      voiceId: preset.voiceId ?? null,
      suggested: false,
      problem: fileProblem(file),
    });
  }
  return result;
}

/** Replaces a file by the parts it was split into (N-18), in place, keeping the list order. */
export function replaceWithParts(
  items: readonly UploadItem[],
  key: string,
  parts: readonly { file: File; scoreId: string | null; scoreTitle: string | null; voiceId: string | null; from: number }[],
): UploadItem[] {
  return items.flatMap((item) =>
    item.key !== key
      ? [item]
      : parts.map((part) => ({
          key: `${key}#${part.from}`,
          file: part.file,
          scoreId: part.scoreId,
          scoreTitle: part.scoreTitle,
          voiceId: part.voiceId,
          suggested: false,
          problem: fileProblem(part.file),
        })),
  );
}

/** Batches for `POST uploads/sheets/upload`, which takes at most 50 files per request. */
export function batches<T>(items: readonly T[], size = UPLOAD_MAX_FILES): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}

/** Files that can be sent (valid type and size). */
export function sendable(items: readonly UploadItem[]): UploadItem[] {
  return items.filter((item) => item.problem === null);
}

/** `meta` part of `POST uploads/sheets/upload`, in the same order as the files. */
export function uploadMeta(items: readonly UploadItem[]): UploadSheetsMeta {
  return { items: items.map((item) => ({ fileName: item.file.name, scoreId: item.scoreId, voiceId: item.voiceId })) };
}

/** „1,2 MB“ for the file list. */
export function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}
