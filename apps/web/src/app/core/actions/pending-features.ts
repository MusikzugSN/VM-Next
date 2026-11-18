import { inject, Injectable, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

import { ZardSonnerService } from '@/shared/components/sonner';

/** What an upload starts from (N-11, M-9): preselected score and voice. */
export interface UploadContext {
  scoreId?: string;
  /** Shown as the preselected score in the dialog. */
  scoreTitle?: string;
  voiceId?: string;
}

/** What a print starts from (D-1): a folder, an event or single sheets. */
export type PrintContext = { folderId: string } | { eventId: string } | { scoreId: string; sheetIds: string[] };

/**
 * Opens the upload dialog (N-11) from anywhere; the dialog itself lives in the app shell.
 * `completed` counts finished uploads, so lists of the current page can reload.
 */
@Injectable({ providedIn: 'root' })
export class UploadLauncher {
  /** Open request; `null` = dialog closed. */
  readonly request = signal<UploadContext | null>(null);
  readonly completed = signal(0);

  open(context: UploadContext = {}): void {
    this.request.set({ ...context });
  }

  close(): void {
    this.request.set(null);
  }

  /** Called by the dialog after a successful upload. */
  notifyCompleted(): void {
    this.completed.update((n) => n + 1);
  }
}

/** Entry point for the print dialog (Stufe 6); until then it explains that the function follows. */
@Injectable({ providedIn: 'root' })
export class PrintLauncher {
  private readonly sonner = inject(ZardSonnerService);
  private readonly transloco = inject(TranslocoService);

  open(context: PrintContext): void {
    void context;
    this.sonner.info(this.transloco.translate('pending.print'));
  }
}
