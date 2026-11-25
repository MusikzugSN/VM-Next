import { mkdtemp, rm } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Server } from 'node:http';

import { PRINT_SERVICE_CONTRACT, printJobListSchema, printJobSchema, type Printer } from '@vm-web/shared';

import { loadConfig, normalizeOrigin } from './config';
import { JobService } from './jobs';
import type { BackendJobState, BackendPrintOptions, PrinterBackend } from './printer-backend';
import { createPrintServer, isPdf } from './server';
import { UpdateError, type Updater } from './updater';

const ORIGIN = 'https://noten.example.org';
const PDF = new TextEncoder().encode('%PDF-1.7\n%test\n');

/** Printer that records jobs; their state is set by the test. */
class FakeBackend implements PrinterBackend {
  readonly printers: Printer[] = [
    { id: 'hp', name: 'HP LaserJet', isDefault: true },
    { id: 'brother', name: 'Brother', isDefault: false },
  ];
  readonly submitted: BackendPrintOptions[] = [];
  readonly cancelled: string[] = [];
  readonly states = new Map<string, BackendJobState>();

  async listPrinters() {
    return this.printers;
  }
  async submit(_file: string, options: BackendPrintOptions) {
    this.submitted.push(options);
    const backendId = `job-${this.submitted.length}`;
    this.states.set(backendId, { status: 'waiting', printedPages: null, error: null });
    return { backendId, printerId: options.printerId ?? 'hp' };
  }
  async state(backendId: string) {
    return this.states.get(backendId) ?? { status: 'failed' as const, printedPages: null, error: 'weg' };
  }
  async cancel(backendId: string) {
    this.cancelled.push(backendId);
  }
}

describe('print service HTTP interface', () => {
  let dir: string;
  let server: Server;
  let base: string;
  let backend: FakeBackend;
  let updates: string[];
  let restarts: number;
  let updateError: UpdateError | null;

  beforeEach(async () => {
    updates = [];
    restarts = 0;
    updateError = null;
    const updater: Updater = {
      update: async (version) => {
        if (updateError) throw updateError;
        updates.push(version);
      },
    };
    dir = await mkdtemp(join(tmpdir(), 'vmweb-print-'));
    backend = new FakeBackend();
    const jobs = new JobService(backend, dir, 30);
    server = createPrintServer({
      config: { allowedOrigin: ORIGIN, maxPdfBytes: 1024 },
      backend,
      jobs,
      version: '1.0.0',
      updater,
      restart: () => restarts++,
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
  });

  afterEach(async () => {
    await new Promise((resolve) => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
  });

  const call = (path: string, init: RequestInit = {}, origin: string | null = ORIGIN) =>
    fetch(base + path, { ...init, headers: { ...(origin ? { Origin: origin } : {}), ...(init.headers as Record<string, string>) } });

  const job = (meta: Record<string, unknown> = {}, pdf: Uint8Array = PDF) => {
    const form = new FormData();
    form.append('file', new Blob([pdf], { type: 'application/pdf' }), 'druck.pdf');
    form.append(
      'meta',
      JSON.stringify({
        contract: PRINT_SERVICE_CONTRACT,
        source: { kind: 'folder', title: 'Marschbuch', voices: ['Trompete 1 in B'] },
        printerId: null,
        pages: 34,
        duplex: true,
        copies: 1,
        ...meta,
      }),
    );
    return call('/jobs', { method: 'POST', body: form });
  };

  it('accepts only the configured origin (D-4)', async () => {
    expect((await call('/status', {}, 'https://evil.example')).status).toBe(403);
    expect((await call('/status', {}, null)).status).toBe(403);
    const ok = await call('/status');
    expect(ok.status).toBe(200);
    expect(ok.headers.get('access-control-allow-origin')).toBe(ORIGIN);
    expect(await ok.json()).toEqual({ version: '1.0.0', contracts: [1], printers: backend.printers });
  });

  it('answers the CORS and Private Network Access preflight', async () => {
    const res = await call('/jobs', {
      method: 'OPTIONS',
      headers: { 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Private-Network': 'true' },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-private-network')).toBe('true');
    expect(res.headers.get('access-control-allow-methods')).toContain('POST');
  });

  it('prints a job and reports its states in the history (D-5)', async () => {
    const created = printJobSchema.parse(await (await job()).json());
    expect(created).toMatchObject({ status: 'waiting', pages: 34, printer: { id: 'hp', name: 'HP LaserJet' } });
    expect(backend.submitted[0]).toEqual({ printerId: null, duplex: true, copies: 1, title: 'Marschbuch' });

    backend.states.set('job-1', { status: 'printing', printedPages: null, error: null });
    let list = printJobListSchema.parse(await (await call('/jobs')).json());
    expect(list.items.map((j) => j.status)).toEqual(['printing']);

    backend.states.set('job-1', { status: 'done', printedPages: null, error: null });
    list = printJobListSchema.parse(await (await call('/jobs')).json());
    expect(list.items[0].status).toBe('done');

    // „Erneut senden“ prints the stored PDF as a new job.
    const again = await call(`/jobs/${created.id}/retry`, { method: 'POST' });
    expect(again.status).toBe(201);
    expect((await (await call('/jobs')).json()).items).toHaveLength(2);
  });

  it('cancels a waiting job', async () => {
    const created = printJobSchema.parse(await (await job({ printerId: 'brother' })).json());
    const res = await call(`/jobs/${created.id}/cancel`, { method: 'POST' });
    expect(printJobSchema.parse(await res.json()).status).toBe('cancelled');
    expect(backend.cancelled).toEqual(['job-1']);
  });

  it('refuses invalid jobs', async () => {
    expect((await (await job({ printerId: 'unknown' })).json()).code).toBe('printer-not-found');
    expect((await (await job({ contract: 99 })).json()).code).toBe('contract-unsupported');
    expect((await (await job({ pages: 0 })).json()).code).toBe('invalid-job');
    expect((await job({}, new TextEncoder().encode('no pdf'))).status).toBe(400);
    expect((await job({}, new Uint8Array(4096))).status).toBe(413);
    expect((await call('/jobs/unknown/cancel', { method: 'POST' })).status).toBe(404);
  });

  it('keeps the history across restarts', async () => {
    await job();
    const reopened = new JobService(backend, dir, 30);
    expect(await reopened.list()).toHaveLength(1);
  });

  const update = (body: unknown) =>
    call('/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  it('updates itself and restarts after answering', async () => {
    const response = await update({ version: '1.2.0' });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ version: '1.2.0' });
    expect(updates).toEqual(['1.2.0']);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(restarts).toBe(1);
  });

  it('refuses updates without a release version and does not restart on errors', async () => {
    expect((await (await update({ version: '1.2.0-dev' })).json()).code).toBe('update-invalid-version');
    expect((await (await update({})).json()).code).toBe('update-invalid-version');
    updateError = new UpdateError(502, 'update-failed', 'weg');
    const failed = await update({ version: '1.2.0' });
    expect(failed.status).toBe(502);
    expect((await failed.json()).code).toBe('update-failed');
    expect(updates).toEqual([]);
    expect(restarts).toBe(0);
  });

  it('accepts updates only from the configured origin', async () => {
    const response = await call('/update', { method: 'POST', body: JSON.stringify({ version: '1.2.0' }) }, 'https://evil.example');
    expect(response.status).toBe(403);
    expect(updates).toEqual([]);
  });
});

describe('configuration', () => {
  it('normalizes the origin and needs one', () => {
    expect(normalizeOrigin('https://Noten.Example.org/')).toBe('https://noten.example.org');
    expect(loadConfig({ VMWEB_PRINT_ORIGIN: 'https://a.example/x', XDG_CONFIG_HOME: '/nowhere' }, '/home/x').allowedOrigin).toBe('https://a.example');
    expect(() => loadConfig({ XDG_CONFIG_HOME: '/nowhere' }, '/home/x')).toThrow(/VM-Web-Adresse/);
  });

  it('recognizes PDFs', () => {
    expect(isPdf(PDF)).toBe(true);
    expect(isPdf(new TextEncoder().encode('<html>'))).toBe(false);
  });
});
