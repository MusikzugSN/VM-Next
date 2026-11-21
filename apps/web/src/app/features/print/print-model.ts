import type { PrintJob, PrintJobStatus, PrintMode, PrintPlanResponse, SubstituteMode } from '@vm-web/shared';

import type { ApiQuery } from '../../core/api/api-client';
import type { PrintRequest } from '../../core/actions/pending-features';

/** Choices of the print dialog. */
export interface PrintOptions {
  /** Folders and events: everything or a selection of their scores. */
  mode: 'all' | 'selection';
  scoreIds: readonly string[];
  voiceIds: readonly string[];
  substitutes: SubstituteMode;
}

/** Query of `print/print-plan` and `print/document` (`printQuerySchema`); both get the same one. */
export function printQuery(request: PrintRequest, options: PrintOptions): ApiQuery {
  const base: ApiQuery = {
    voiceId: [...options.voiceIds],
    substitutes: options.substitutes,
  };
  if (request.scope === 'selection') {
    return { ...base, scope: 'selection', scoreIds: [...(request.scoreIds ?? [])], folderId: request.folderId, eventId: request.eventId };
  }
  const context = request.scope === 'folder' ? { folderId: request.id } : request.scope === 'event' ? { eventId: request.id } : { scoreId: request.id };
  if (request.scope !== 'score' && options.mode === 'selection') {
    return { ...base, ...context, scope: 'selection', scoreIds: [...options.scoreIds] };
  }
  return { ...base, ...context, scope: request.scope };
}

/** Scores of a plan in print order, once each (a score appears per voice). */
export function planScores(plan: PrintPlanResponse): { scoreId: string; number: string | null; title: string }[] {
  const seen = new Set<string>();
  const result: { scoreId: string; number: string | null; title: string }[] = [];
  for (const doc of plan.documents) {
    if (seen.has(doc.scoreId)) continue;
    seen.add(doc.scoreId);
    result.push({ scoreId: doc.scoreId, number: doc.number, title: doc.title });
  }
  return result;
}

/** How a score lands on paper by its print rule (D-6), as i18n key + params: „→ 1 Blatt beidseitig“. */
export function sheetsLabel(sheets: number, mode: PrintMode): { key: string; params: { sheets: number } } {
  if (mode === 'simplex') return { key: sheets === 1 ? 'print.sheets.single' : 'print.sheets.simplex', params: { sheets } };
  return { key: sheets === 1 ? 'print.sheets.duplexOne' : 'print.sheets.duplex', params: { sheets } };
}

/** Status changes between two polls of the history, for the toasts (D-5). */
export function statusChanges(before: readonly PrintJob[], after: readonly PrintJob[]): { job: PrintJob; status: PrintJobStatus }[] {
  const previous = new Map(before.map((job) => [job.id, job.status]));
  return after.filter((job) => previous.has(job.id) && previous.get(job.id) !== job.status).map((job) => ({ job, status: job.status }));
}

/** Jobs that can still be cancelled, resp. sent again. */
export const isRunning = (status: PrintJobStatus) => status === 'waiting' || status === 'printing';
export const canRetry = (status: PrintJobStatus) => status === 'failed' || status === 'done' || status === 'cancelled';
