import { Injectable, signal } from '@angular/core';

/** What an upload starts from (N-11, M-9): preselected score and voice. */
export interface UploadContext {
  scoreId?: string;
  /** Shown as the preselected score in the dialog. */
  scoreTitle?: string;
  voiceId?: string;
}

/** What a print starts from (D-1, M-7): a score, folder, event or a selection from a list, with a title for dialog and history. */
export interface PrintRequest {
  scope: 'score' | 'folder' | 'event' | 'selection';
  /** Score, folder or event id; empty for a selection. */
  id: string;
  title: string;
  /** Preselected voices; without them the active voices of the voice switch (M-2). */
  voiceIds?: readonly string[];
  /** Selection only: the chosen scores and the list they come from (numbers and order, F-9). */
  scoreIds?: readonly string[];
  folderId?: string;
  eventId?: string;
}

/** Bridge to a dialog that lives in the app shell: pages request it, the dialog reads the request. */
abstract class DialogLauncher<T extends object> {
  /** Open request; `null` = dialog closed. */
  readonly request = signal<T | null>(null);

  open(request: T): void {
    this.request.set({ ...request });
  }

  close(): void {
    this.request.set(null);
  }
}

/**
 * Opens the upload dialog (N-11) from anywhere; the dialog itself lives in the app shell.
 * `completed` counts finished uploads, so lists of the current page can reload.
 */
@Injectable({ providedIn: 'root' })
export class UploadLauncher extends DialogLauncher<UploadContext> {
  readonly completed = signal(0);

  override open(context: UploadContext = {}): void {
    super.open(context);
  }

  /** Called by the dialog after a successful upload. */
  notifyCompleted(): void {
    this.completed.update((n) => n + 1);
  }
}

/** Opens the print dialog (D-1) from anywhere; the dialog itself lives in the app shell. */
@Injectable({ providedIn: 'root' })
export class PrintLauncher extends DialogLauncher<PrintRequest> {}
