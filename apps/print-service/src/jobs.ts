import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { PrintJob, PrintJobMeta } from '@vm-web/shared';

import type { PrinterBackend } from './printer-backend';

/** A job plus what the service needs to re-print it. */
export interface StoredJob extends PrintJob {
  backendId: string | null;
  pdfFile: string;
  duplex: boolean;
  copies: number;
}

/** Error with a code from `printServiceErrorSchema`. */
export class JobError extends Error {
  constructor(
    readonly code: 'invalid-job' | 'printer-not-found' | 'job-not-found' | 'internal-error',
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

const DAY_MS = 86_400_000;

/**
 * Jobs and their local history (D-5): kept in `<dataDir>/jobs.json`, PDFs in `<dataDir>/pdf/`
 * for „Erneut senden“; everything older than the retention period is removed.
 */
export class JobService {
  private jobs: StoredJob[] = [];
  private loaded = false;
  private chain: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly backend: PrinterBackend,
    private readonly dataDir: string,
    private readonly retentionDays: number,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /**
   * Every operation that touches `jobs.json` runs after the previous one: the print dialog polls
   * `list()` every 2 s, so a poll and a submit overlap as a matter of course (D-5).
   */
  private serial<T>(work: () => Promise<T>): Promise<T> {
    const run = this.chain.then(work, work);
    this.chain = run.catch(() => undefined);
    return run;
  }

  /** History, newest first, states refreshed from the printing system. */
  async list(): Promise<PrintJob[]> {
    return this.serial(async () => {
      await this.load();
      await this.refresh();
      return this.jobs.map(toPublic);
    });
  }

  async submit(pdf: Uint8Array, meta: PrintJobMeta): Promise<PrintJob> {
    return this.serial(async () => {
      await this.load();
      const printers = await this.backend.listPrinters();
      if (meta.printerId && !printers.some((p) => p.id === meta.printerId)) throw new JobError('printer-not-found', `Unbekannter Drucker: ${meta.printerId}`);
      const id = randomUUID();
      const pdfFile = join(this.dataDir, 'pdf', `${id}.pdf`);
      await mkdir(join(this.dataDir, 'pdf'), { recursive: true });
      await writeFile(pdfFile, pdf);
      const job = await this.print({ id, pdfFile, meta: { source: meta.source, pages: meta.pages, duplex: meta.duplex, copies: meta.copies, printerId: meta.printerId } }, printers);
      return toPublic(job);
    });
  }

  async cancel(jobId: string): Promise<PrintJob> {
    return this.serial(async () => {
      await this.load();
      const job = this.find(jobId);
      if (job.status === 'waiting' || job.status === 'printing') {
        if (job.backendId) await this.backend.cancel(job.backendId).catch(() => undefined);
        this.update(job, { status: 'cancelled', error: null });
        await this.save();
      }
      return toPublic(job);
    });
  }

  /** Prints the same PDF again as a new job. */
  async retry(jobId: string): Promise<PrintJob> {
    return this.serial(async () => {
      await this.load();
      const old = this.find(jobId);
      const printers = await this.backend.listPrinters();
      const printerId = printers.some((p) => p.id === old.printer.id) ? old.printer.id : null;
      const job = await this.print(
        { id: randomUUID(), pdfFile: old.pdfFile, meta: { source: old.source, pages: old.pages, duplex: old.duplex, copies: old.copies, printerId } },
        printers,
      );
      return toPublic(job);
    });
  }

  private async print(
    input: { id: string; pdfFile: string; meta: Pick<PrintJobMeta, 'source' | 'pages' | 'duplex' | 'copies' | 'printerId'> },
    printers: { id: string; name: string }[],
  ): Promise<StoredJob> {
    const now = this.now().toISOString();
    const job: StoredJob = {
      id: input.id,
      source: input.meta.source,
      printer: { id: input.meta.printerId ?? '', name: '' },
      pages: input.meta.pages,
      status: 'waiting',
      printedPages: null,
      error: null,
      createdAt: now,
      updatedAt: now,
      backendId: null,
      pdfFile: input.pdfFile,
      duplex: input.meta.duplex,
      copies: input.meta.copies,
    };
    try {
      const sent = await this.backend.submit(input.pdfFile, {
        printerId: input.meta.printerId,
        duplex: input.meta.duplex,
        copies: input.meta.copies,
        title: input.meta.source.title,
      });
      job.backendId = sent.backendId;
      job.printer = { id: sent.printerId, name: printers.find((p) => p.id === sent.printerId)?.name ?? sent.printerId };
    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : String(error);
    }
    this.jobs.unshift(job);
    await this.save();
    return job;
  }

  /** Asks the printing system for jobs that are still running. */
  private async refresh(): Promise<void> {
    let changed = false;
    for (const job of this.jobs) {
      if ((job.status !== 'waiting' && job.status !== 'printing') || !job.backendId) continue;
      const state = await this.backend.state(job.backendId, job.printer.id).catch(() => null);
      if (!state) continue;
      if (state.status !== job.status || state.printedPages !== job.printedPages || state.error !== job.error) {
        this.update(job, state);
        changed = true;
      }
    }
    if (changed) await this.save();
  }

  private update(job: StoredJob, patch: Partial<Pick<StoredJob, 'status' | 'printedPages' | 'error'>>): void {
    Object.assign(job, patch, { updatedAt: this.now().toISOString() });
  }

  private find(jobId: string): StoredJob {
    const job = this.jobs.find((j) => j.id === jobId);
    if (!job) throw new JobError('job-not-found', 'Auftrag nicht gefunden.', 404);
    return job;
  }

  private get file(): string {
    return join(this.dataDir, 'jobs.json');
  }

  private async load(): Promise<void> {
    if (this.loaded) return;
    try {
      this.jobs = JSON.parse(await readFile(this.file, 'utf8')) as StoredJob[];
    } catch {
      this.jobs = [];
    }
    this.loaded = true;
    await this.purge();
  }

  /** Drops jobs (and PDFs no other job uses) older than the retention period. */
  private async purge(): Promise<void> {
    const limit = this.now().getTime() - this.retentionDays * DAY_MS;
    const old = this.jobs.filter((j) => new Date(j.createdAt).getTime() < limit);
    if (!old.length) return;
    this.jobs = this.jobs.filter((j) => !old.includes(j));
    const inUse = new Set(this.jobs.map((j) => j.pdfFile));
    for (const job of old) if (!inUse.has(job.pdfFile)) await rm(job.pdfFile, { force: true });
    await this.save();
  }

  /** Atomic write: a crash never leaves a half-written history. */
  private async save(): Promise<void> {
    await mkdir(this.dataDir, { recursive: true });
    const tmp = `${this.file}.${randomUUID()}.tmp`;
    try {
      await writeFile(tmp, JSON.stringify(this.jobs, null, 2));
      await rename(tmp, this.file);
    } catch (error) {
      await rm(tmp, { force: true });
      throw error;
    }
  }
}

function toPublic(job: StoredJob): PrintJob {
  return {
    id: job.id,
    source: job.source,
    printer: job.printer,
    pages: job.pages,
    status: job.status,
    printedPages: job.printedPages,
    error: job.error,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}
