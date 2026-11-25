import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

import {
  PRINT_JOB_FILE_FIELD,
  PRINT_JOB_META_FIELD,
  PRINT_SERVICE_CONTRACT,
  printJobMetaSchema,
  printServiceUpdateRequestSchema,
  type PrintServiceError,
  type PrintServiceStatus,
  type PrintServiceUpdateResult,
} from '@vm-web/shared';

import type { ServiceConfig } from './config';
import { JobError, type JobService } from './jobs';
import type { PrinterBackend } from './printer-backend';
import { UpdateError, type Updater } from './updater';

export interface ServerDeps {
  config: Pick<ServiceConfig, 'allowedOrigin' | 'maxPdfBytes'>;
  backend: PrinterBackend;
  jobs: JobService;
  version: string;
  updater: Updater;
  /** Ends the process after a successful update, so systemd starts the new binary. */
  restart: () => void;
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: PrintServiceError['code'],
    message: string,
  ) {
    super(message);
  }
}

const JOB_ACTION = /^\/v1\/jobs\/([^/]+)\/(cancel|retry)$/;

/**
 * HTTP interface of the print service (docs/print-service.md): only the configured VM-Web origin
 * is accepted (D-4); CORS and Chrome's Private Network Access preflight are answered for it.
 */
export function createPrintServer(deps: ServerDeps): Server {
  return createServer((req, res) => {
    void handle(deps, req, res).catch((error: unknown) => {
      if (error instanceof HttpError || error instanceof JobError || error instanceof UpdateError) send(res, error.status, { code: error.code, message: error.message });
      else send(res, 500, { code: 'internal-error', message: error instanceof Error ? error.message : 'Interner Fehler' });
    });
  });
}

async function handle(deps: ServerDeps, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const origin = req.headers.origin;
  if (origin !== deps.config.allowedOrigin) {
    throw new HttpError(403, 'origin-not-allowed', 'Diese Adresse darf keine Aufträge senden.');
  }
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '600');
    if (req.headers['access-control-request-private-network'] === 'true') res.setHeader('Access-Control-Allow-Private-Network', 'true');
    res.writeHead(204).end();
    return;
  }

  const path = new URL(req.url ?? '/', 'http://127.0.0.1').pathname;
  if (req.method === 'GET' && path === '/v1/status') {
    const status: PrintServiceStatus = { version: deps.version, contracts: [PRINT_SERVICE_CONTRACT], printers: await deps.backend.listPrinters() };
    return send(res, 200, status);
  }
  if (req.method === 'GET' && path === '/v1/jobs') return send(res, 200, { items: await deps.jobs.list() });
  if (req.method === 'POST' && path === '/v1/jobs') return send(res, 201, await submit(deps, req));
  if (req.method === 'POST' && path === '/v1/update') return update(deps, req, res);
  const action = req.method === 'POST' ? JOB_ACTION.exec(path) : null;
  if (action) {
    const id = decodeURIComponent(action[1]);
    return action[2] === 'cancel' ? send(res, 200, await deps.jobs.cancel(id)) : send(res, 201, await deps.jobs.retry(id));
  }
  throw new HttpError(404, 'job-not-found', 'Unbekannter Pfad.');
}

async function submit(deps: ServerDeps, req: IncomingMessage) {
  const type = req.headers['content-type'] ?? '';
  if (!type.startsWith('multipart/form-data')) throw new HttpError(400, 'invalid-job', 'Erwartet multipart/form-data.');
  const body = await readBody(req, deps.config.maxPdfBytes + 64 * 1024);
  // The built-in Fetch API parses multipart, no extra dependency needed.
  const form = await new Request('http://127.0.0.1/', { method: 'POST', headers: { 'content-type': type }, body: new Uint8Array(body) }).formData();
  const file = form.get(PRINT_JOB_FILE_FIELD);
  const metaText = form.get(PRINT_JOB_META_FIELD);
  if (!(file instanceof Blob) || typeof metaText !== 'string') throw new HttpError(400, 'invalid-job', 'Datei oder Angaben fehlen.');

  let metaJson: unknown;
  try {
    metaJson = JSON.parse(metaText);
  } catch {
    throw new HttpError(400, 'invalid-job', 'Angaben sind kein JSON.');
  }
  if ((metaJson as { contract?: unknown } | null)?.contract !== PRINT_SERVICE_CONTRACT) {
    throw new HttpError(400, 'contract-unsupported', `Vertrag ${PRINT_SERVICE_CONTRACT} erwartet.`);
  }
  const meta = printJobMetaSchema.safeParse(metaJson);
  if (!meta.success) throw new HttpError(400, 'invalid-job', 'Angaben zum Auftrag sind ungültig.');

  const pdf = new Uint8Array(await file.arrayBuffer());
  if (pdf.byteLength > deps.config.maxPdfBytes) throw new HttpError(413, 'invalid-job', 'Das PDF ist zu groß.');
  if (!isPdf(pdf)) throw new HttpError(400, 'invalid-job', 'Die Datei ist kein PDF.');
  return deps.jobs.submit(pdf, meta.data);
}

/** Replaces the binary, answers, and only then restarts (docs/print-service.md › Update). */
async function update(deps: ServerDeps, req: IncomingMessage, res: ServerResponse): Promise<void> {
  let json: unknown;
  try {
    json = JSON.parse((await readBody(req, 4 * 1024)).toString('utf8'));
  } catch {
    throw new HttpError(400, 'update-invalid-version', 'Angaben sind kein JSON.');
  }
  const request = printServiceUpdateRequestSchema.safeParse(json);
  if (!request.success) throw new HttpError(400, 'update-invalid-version', 'Release-Version X.Y.Z erwartet.');
  await deps.updater.update(request.data.version);
  res.on('finish', () => deps.restart());
  const result: PrintServiceUpdateResult = { version: request.data.version };
  send(res, 200, result);
}

/** `%PDF-` at the start. */
export function isPdf(bytes: Uint8Array): boolean {
  return bytes.length > 4 && String.fromCharCode(...bytes.subarray(0, 5)) === '%PDF-';
}

function readBody(req: IncomingMessage, limit: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        reject(new HttpError(413, 'invalid-job', 'Das PDF ist zu groß.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function send(res: ServerResponse, status: number, body: unknown): void {
  if (res.headersSent) return;
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }).end(JSON.stringify(body));
}
