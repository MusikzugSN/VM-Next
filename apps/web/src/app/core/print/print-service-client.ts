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
  type PrintJob,
  type PrintJobMeta,
  type PrintServiceStatus,
} from '@vm-web/shared';
import type { z } from 'zod';

/** How long VM-Web waits for the local service before it counts as „not running“ (D-3). */
export const PRINT_SERVICE_TIMEOUT_MS = 1500;

/** Reachability of the local print service, as the UI needs it. */
export type PrintServiceState =
  | { kind: 'ready'; status: PrintServiceStatus }
  /** Running, but too old for this VM-Web (contract) or refusing our origin. */
  | { kind: 'incompatible'; reason: 'contract' | 'origin' }
  | { kind: 'offline' };

/** Error of a job request, with the service's code if it sent one. */
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
    if (!parsed.data.contracts.includes(PRINT_SERVICE_CONTRACT)) return { kind: 'incompatible', reason: 'contract' };
    return { kind: 'ready', status: parsed.data };
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
