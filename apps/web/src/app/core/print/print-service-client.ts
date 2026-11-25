import { Injectable, InjectionToken, inject } from '@angular/core';
import {
  PRINT_JOB_FILE_FIELD,
  PRINT_JOB_META_FIELD,
  PRINT_SERVICE_BASE,
  PRINT_SERVICE_CONTRACT,
  PRINT_SERVICE_ROUTES,
  printJobListSchema,
  printJobSchema,
  printServiceErrorSchema,
  printServiceStatusSchema,
  printServiceUpdateResultSchema,
  type PrintJob,
  type PrintJobMeta,
  type PrintServiceStatus,
} from '@vm-web/shared';
import type { z } from 'zod';

/** How long VM-Web waits for the local service before it counts as „not running“ (D-3). */
export const PRINT_SERVICE_TIMEOUT_MS = 1500;
/** The update downloads the release archive (about 40 MB) before it answers. */
export const PRINT_SERVICE_UPDATE_TIMEOUT_MS = 5 * 60_000;
/** Set once the service answered in this browser; see `PrintServiceClient.seenBefore`. */
const SEEN_KEY = 'vm-web.printService.seen';

/** Reachability of the local print service, as the UI needs it. */
export type PrintServiceState =
  | { kind: 'ready'; status: PrintServiceStatus }
  /** Running, but too old for this VM-Web (contract) or refusing our origin. */
  | { kind: 'incompatible'; reason: 'contract' | 'origin' }
  | { kind: 'offline' };

/** The non-ready states, for the install-guide UI that explains and helps fix them. */
export type PrintServiceIssue = Exclude<PrintServiceState, { kind: 'ready' }>;

/**
 * Error of a request, with the service's code if it sent one. `update-unavailable`: the service is
 * older than POST /update and has to be updated by hand once.
 */
export class PrintServiceFailure extends Error {
  constructor(readonly code: string) {
    super(`print service: ${code}`);
    this.name = 'PrintServiceFailure';
  }
}

/**
 * Access to the local print service (`docs/print-service.md`). Behind a token, so tests and the
 * missing service can be replaced by a fake.
 */
export interface PrintServiceClient {
  state(): Promise<PrintServiceState>;
  jobs(): Promise<PrintJob[]>;
  submit(pdf: Blob, meta: PrintJobMeta): Promise<PrintJob>;
  cancel(jobId: string): Promise<PrintJob>;
  retry(jobId: string): Promise<PrintJob>;
  /** Lets the service replace itself with release `version` and restart (POST /update). */
  update(version: string): Promise<void>;
  /**
   * Whether the service was ever reachable in this browser. Checks that run without the person
   * asking (e.g. on start) only talk to localhost then, so browsers don't ask everyone for
   * local-network access.
   */
  seenBefore(): boolean;
}

export const PRINT_SERVICE = new InjectionToken<PrintServiceClient>('PRINT_SERVICE', {
  providedIn: 'root',
  factory: () => inject(HttpPrintServiceClient),
});

/** Talks to `http://127.0.0.1:17631/v1` with `fetch` (no cookies, no API interceptors). */
@Injectable({ providedIn: 'root' })
export class HttpPrintServiceClient implements PrintServiceClient {
  async state(): Promise<PrintServiceState> {
    let response: Response;
    try {
      response = await fetch(PRINT_SERVICE_BASE + PRINT_SERVICE_ROUTES.status, { signal: AbortSignal.timeout(PRINT_SERVICE_TIMEOUT_MS) });
    } catch {
      return { kind: 'offline' };
    }
    if (response.status === 403) return { kind: 'incompatible', reason: 'origin' };
    if (!response.ok) return { kind: 'offline' };
    const parsed = printServiceStatusSchema.safeParse(await response.json().catch(() => null));
    if (!parsed.success) return { kind: 'offline' };
    this.markSeen();
    if (!parsed.data.contracts.includes(PRINT_SERVICE_CONTRACT)) return { kind: 'incompatible', reason: 'contract' };
    return { kind: 'ready', status: parsed.data };
  }

  seenBefore(): boolean {
    try {
      return localStorage.getItem(SEEN_KEY) === '1';
    } catch {
      return false;
    }
  }

  private markSeen(): void {
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch {
      // storage blocked: the start check just stays off
    }
  }

  async jobs(): Promise<PrintJob[]> {
    return (await this.request(PRINT_SERVICE_ROUTES.jobs, { method: 'GET' }, printJobListSchema)).items;
  }

  submit(pdf: Blob, meta: PrintJobMeta): Promise<PrintJob> {
    const form = new FormData();
    form.append(PRINT_JOB_FILE_FIELD, pdf, 'druck.pdf');
    form.append(PRINT_JOB_META_FIELD, JSON.stringify(meta));
    return this.request(PRINT_SERVICE_ROUTES.jobs, { method: 'POST', body: form }, printJobSchema);
  }

  cancel(jobId: string): Promise<PrintJob> {
    return this.request(PRINT_SERVICE_ROUTES.cancel(jobId), { method: 'POST' }, printJobSchema);
  }

  retry(jobId: string): Promise<PrintJob> {
    return this.request(PRINT_SERVICE_ROUTES.retry(jobId), { method: 'POST' }, printJobSchema);
  }

  async update(version: string): Promise<void> {
    const init: RequestInit = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version }),
      signal: AbortSignal.timeout(PRINT_SERVICE_UPDATE_TIMEOUT_MS),
    };
    try {
      await this.request(PRINT_SERVICE_ROUTES.update, init, printServiceUpdateResultSchema);
    } catch (error) {
      // Services before POST /update answer unknown paths with 404 job-not-found
      if (error instanceof PrintServiceFailure && error.code === 'job-not-found') throw new PrintServiceFailure('update-unavailable');
      throw error;
    }
  }

  private async request<S extends z.ZodType>(path: string, init: RequestInit, schema: S): Promise<z.output<S>> {
    let response: Response;
    try {
      response = await fetch(PRINT_SERVICE_BASE + path, init);
    } catch {
      throw new PrintServiceFailure('offline');
    }
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const problem = printServiceErrorSchema.safeParse(body);
      throw new PrintServiceFailure(problem.success ? problem.data.code : 'internal-error');
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new PrintServiceFailure('internal-error');
    return parsed.data;
  }
}
