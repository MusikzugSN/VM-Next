import { execFile } from 'node:child_process';

import type { Printer } from '@vm-web/shared';

import type { BackendJobState, BackendPrintOptions, PrinterBackend } from './printer-backend';

/** Runs a command and returns stdout; rejects with stderr on a non-zero exit. */
export type Run = (command: string, args: readonly string[]) => Promise<string>;

export const runCommand: Run = (command, args) =>
  new Promise((resolve, reject) => {
    // C locale: lpstat/lp output is parsed, translated messages would break that.
    execFile(command, [...args], { env: { ...process.env, LANG: 'C', LC_ALL: 'C' }, timeout: 15_000 }, (error, stdout, stderr) => {
      if ((error as NodeJS.ErrnoException | null)?.code === 'ENOENT') reject(new Error(`„${command}“ nicht gefunden – ist CUPS installiert?`));
      else if (error) reject(new Error(stderr.trim() || error.message));
      else resolve(stdout);
    });
  });

/** `lpstat -e` → one queue name per line. */
export function parseQueues(output: string): string[] {
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

/** `lpstat -d` → `system default destination: HP_LaserJet` or `no system default destination`. */
export function parseDefault(output: string): string | null {
  const match = /system default destination:\s*(\S+)/.exec(output);
  return match ? match[1] : null;
}

/** `lpoptions -p X` → `printer-info='HP LaserJet M110'` (or unquoted); falls back to the queue name. */
export function parseInfo(output: string, queue: string): string {
  const match = /printer-info=(?:'([^']*)'|"([^"]*)"|(\S+))/.exec(output);
  const info = match?.[1] ?? match?.[2] ?? match?.[3];
  return info?.trim() || queue.replace(/_/g, ' ');
}

/** `lp` → `request id is HP_LaserJet-42 (1 file(s))`. */
export function parseRequestId(output: string): string | null {
  return /request id is (\S+)/.exec(output)?.[1] ?? null;
}

/** Whether a job id is listed in `lpstat -o` style output (first column). */
export function listsJob(output: string, backendId: string): boolean {
  return output.split('\n').some((line) => line.trim().split(/\s+/)[0] === backendId);
}

/** `lpstat -p X` → `printer X now printing X-42.  enabled since …`. */
export function isPrinting(output: string, backendId: string): boolean {
  return new RegExp(`now printing ${backendId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(output);
}

/**
 * Linux printing through the CUPS command line tools (D-4). Progress in pages is not reported by
 * `lpstat`, so `printedPages` stays `null`.
 */
export class CupsBackend implements PrinterBackend {
  constructor(private readonly run: Run = runCommand) {}

  async listPrinters(): Promise<Printer[]> {
    const [queues, defaultOutput] = await Promise.all([this.run('lpstat', ['-e']).then(parseQueues), this.run('lpstat', ['-d']).catch(() => '')]);
    const defaultQueue = parseDefault(defaultOutput);
    return Promise.all(
      queues.map(async (queue) => {
        const options = await this.run('lpoptions', ['-p', queue]).catch(() => '');
        return { id: queue, name: parseInfo(options, queue), isDefault: queue === defaultQueue };
      }),
    );
  }

  async submit(file: string, options: BackendPrintOptions): Promise<{ backendId: string; printerId: string }> {
    const printerId = options.printerId ?? parseDefault(await this.run('lpstat', ['-d']).catch(() => ''));
    if (!printerId) throw new Error('Kein Standarddrucker eingerichtet.');
    const output = await this.run('lp', [
      '-d',
      printerId,
      '-n',
      String(options.copies),
      '-t',
      options.title,
      '-o',
      options.duplex ? 'sides=two-sided-long-edge' : 'sides=one-sided',
      // The PDF from VM-Web is already laid out for A4 (D-1); do not scale it again.
      '-o',
      'fit-to-page=false',
      file,
    ]);
    const backendId = parseRequestId(output);
    if (!backendId) throw new Error(`Unerwartete Antwort von lp: ${output.trim()}`);
    return { backendId, printerId };
  }

  async state(backendId: string, printerId: string): Promise<BackendJobState> {
    const open = await this.run('lpstat', ['-W', 'not-completed', '-o', printerId]);
    if (listsJob(open, backendId)) {
      const printer = await this.run('lpstat', ['-p', printerId]).catch(() => '');
      return { status: isPrinting(printer, backendId) ? 'printing' : 'waiting', printedPages: null, error: null };
    }
    const done = await this.run('lpstat', ['-W', 'completed', '-o', printerId]);
    if (listsJob(done, backendId)) return { status: 'done', printedPages: null, error: null };
    return { status: 'failed', printedPages: null, error: 'Der Auftrag ist im Drucksystem nicht mehr vorhanden.' };
  }

  async cancel(backendId: string): Promise<void> {
    await this.run('cancel', [backendId]);
  }
}
