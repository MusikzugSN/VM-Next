import type { Printer, PrintJobStatus } from '@vm-web/shared';

/** State of a job as the printing system reports it. */
export interface BackendJobState {
  status: Exclude<PrintJobStatus, 'cancelled'>;
  printedPages: number | null;
  error: string | null;
}

export interface BackendPrintOptions {
  /** `null` = default printer. */
  printerId: string | null;
  duplex: boolean;
  copies: number;
  /** Shown in the printer queue. */
  title: string;
}

/**
 * Printing behind an interface (D-4): CUPS on Linux in the MVP, Windows later as a second
 * implementation. Tests use a fake.
 */
export interface PrinterBackend {
  listPrinters(): Promise<Printer[]>;
  /** Sends a PDF; returns the job id of the printing system and the printer actually used. */
  submit(file: string, options: BackendPrintOptions): Promise<{ backendId: string; printerId: string }>;
  state(backendId: string, printerId: string): Promise<BackendJobState>;
  cancel(backendId: string): Promise<void>;
}
