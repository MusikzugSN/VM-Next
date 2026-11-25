import * as z from 'zod';

/**
 * Contract between VM-Web in the browser and the local print service (D-3, D-4, D-5).
 * The print service is a separate Node app on the musician's computer; it is not part of the API.
 * The details (port, CORS, origin check) are described in `docs/print-service.md`.
 */

/** Fixed port on 127.0.0.1; the service never listens on other interfaces (D-4). */
export const PRINT_SERVICE_PORT = 17631;
export const PRINT_SERVICE_BASE = `http://127.0.0.1:${PRINT_SERVICE_PORT}/v1`;
/** Version of this contract; the service reports the versions it understands. */
export const PRINT_SERVICE_CONTRACT = 1;

/** Paths below `PRINT_SERVICE_BASE`. */
export const PRINT_SERVICE_ROUTES = {
  /** GET – reachability, printers. */
  status: '/status',
  /** GET – local history (D-5); POST – new job (multipart). */
  jobs: '/jobs',
  /** POST – cancel a waiting or printing job. */
  cancel: (jobId: string) => `/jobs/${encodeURIComponent(jobId)}/cancel`,
  /** POST – send a failed or finished job again (same PDF, kept by the service). */
  retry: (jobId: string) => `/jobs/${encodeURIComponent(jobId)}/retry`,
  /** POST – update the service itself to a newer release (`printServiceUpdateRequestSchema`). */
  update: '/update',
} as const;

/** Release of the print service on GitHub; the update loads its archive from here. */
export const PRINT_SERVICE_RELEASES = 'https://github.com/MusikzugSN/VM-Next/releases';

/** Release versions are plain `X.Y.Z`; anything else (`0.0.0-dev`, `0.0.0`) is a development build. */
const RELEASE_VERSION = /^(\d+)\.(\d+)\.(\d+)$/;

/** `true` for a published release version (`1.2.3`), `false` for development builds and `0.0.0`. */
export function isReleaseVersion(version: string): boolean {
  return RELEASE_VERSION.test(version) && version !== '0.0.0';
}

/** Compares two `X.Y.Z` versions: negative if `a < b`, 0 if equal, positive if `a > b`. */
export function compareVersions(a: string, b: string): number {
  const pa = RELEASE_VERSION.exec(a);
  const pb = RELEASE_VERSION.exec(b);
  if (!pa || !pb) throw new Error(`Keine Release-Version: ${pa ? b : a}`);
  for (let i = 1; i <= 3; i++) {
    const diff = Number(pa[i]) - Number(pb[i]);
    if (diff !== 0) return diff;
  }
  return 0;
}

export const printerSchema = z.object({
  /** CUPS queue name on Linux. */
  id: z.string().min(1),
  name: z.string(),
  isDefault: z.boolean(),
});
export type Printer = z.infer<typeof printerSchema>;

/** GET /status → 200. */
export const printServiceStatusSchema = z.object({
  /** App version of the service, e.g. `1.0.0`. */
  version: z.string(),
  /** Contract versions the service understands; VM-Web needs `PRINT_SERVICE_CONTRACT`. */
  contracts: z.array(z.number().int()),
  printers: z.array(printerSchema),
});
export type PrintServiceStatus = z.infer<typeof printServiceStatusSchema>;

/** D-5: wartend, druckt, fertig, Fehler (+ abgebrochen by the person). */
export const printJobStatusSchema = z.enum(['waiting', 'printing', 'done', 'failed', 'cancelled']);
export type PrintJobStatus = z.infer<typeof printJobStatusSchema>;

/** What was printed, as shown in the history (titles only, no ids of VM-Web needed). */
export const printJobSourceSchema = z.object({
  kind: z.enum(['score', 'folder', 'event', 'selection']),
  /** Folder, event or score title. */
  title: z.string().min(1).max(200),
  /** Voice names, e.g. `["Trompete 1 in B"]`. */
  voices: z.array(z.string().max(100)).max(20),
});
export type PrintJobSource = z.infer<typeof printJobSourceSchema>;

/**
 * POST /jobs – `multipart/form-data` with
 * - `file`: the print-ready PDF from `GET print/document` (D-1),
 * - `meta`: JSON matching this schema.
 * → 201 `printJobSchema`.
 */
export const PRINT_JOB_FILE_FIELD = 'file';
export const PRINT_JOB_META_FIELD = 'meta';
export const printJobMetaSchema = z.object({
  contract: z.literal(PRINT_SERVICE_CONTRACT),
  source: printJobSourceSchema,
  /** `null` = default printer of the system. */
  printerId: z.string().min(1).nullable(),
  /** Pages of the PDF (incl. blank pages), for progress and history. */
  pages: z.number().int().min(1),
  /** The PDF already contains blank pages for duplex (D-1); the service only sets the CUPS option. */
  duplex: z.boolean(),
  copies: z.number().int().min(1).max(50).default(1),
});
export type PrintJobMeta = z.infer<typeof printJobMetaSchema>;

export const printJobSchema = z.object({
  id: z.string().min(1),
  source: printJobSourceSchema,
  printer: z.object({ id: z.string(), name: z.string() }),
  pages: z.number().int(),
  status: printJobStatusSchema,
  /** Printed pages while `printing`, if CUPS reports them. */
  printedPages: z.number().int().nullable(),
  /** Plain text for `failed`, e.g. „Drucker nicht erreichbar“. */
  error: z.string().nullable(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});
export type PrintJob = z.infer<typeof printJobSchema>;

/** GET /jobs → 200, newest first; the service keeps the last 30 days (D-5). */
export const printJobListSchema = z.object({ items: z.array(printJobSchema) });
export type PrintJobList = z.infer<typeof printJobListSchema>;

/**
 * POST /update – JSON. The service loads `vm-web-print-<version>-linux-<arch>.tar.gz` of release
 * `v<version>`, checks it against `SHA256SUMS`, replaces its binary and restarts (exit code ≠ 0,
 * systemd starts it again). Only newer release versions are accepted. → 200 `printServiceUpdateResultSchema`,
 * sent before the restart.
 */
export const printServiceUpdateRequestSchema = z.object({
  version: z.string().refine(isReleaseVersion, 'Release-Version X.Y.Z erwartet'),
});
export type PrintServiceUpdateRequest = z.infer<typeof printServiceUpdateRequestSchema>;

export const printServiceUpdateResultSchema = z.object({
  /** Version that runs after the restart. */
  version: z.string(),
});
export type PrintServiceUpdateResult = z.infer<typeof printServiceUpdateResultSchema>;

/** Error body of the service for 4xx/5xx. */
export const printServiceErrorSchema = z.object({
  code: z.enum([
    'origin-not-allowed',
    'contract-unsupported',
    'invalid-job',
    'printer-not-found',
    'job-not-found',
    'internal-error',
    /** Not an installed release binary (development, other OS) – update by hand. */
    'update-unsupported',
    /** Not a release version or not newer than the running one. */
    'update-invalid-version',
    /** Another update is running. */
    'update-running',
    /** Download, checksum or replacing the binary failed. */
    'update-failed',
  ]),
  message: z.string(),
});
export type PrintServiceError = z.infer<typeof printServiceErrorSchema>;
