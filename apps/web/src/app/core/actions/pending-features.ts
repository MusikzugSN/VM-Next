import { inject, Injectable } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

import { ZardSonnerService } from '@/shared/components/sonner';

/** What an upload starts from (N-11, M-9): preselected score and voice. */
export interface UploadContext {
  scoreId?: string;
  voiceId?: string;
}

/** What a print starts from (D-1): a folder, an event or single sheets. */
export type PrintContext = { folderId: string } | { eventId: string } | { scoreId: string; sheetIds: string[] };

/**
 * Entry points for the upload dialog (Stufe 4) and the print dialog (Stufe 6). Pages of Mein Bereich
 * already call them; until the dialogs exist they explain that the function follows.
 */
@Injectable({ providedIn: 'root' })
export class UploadLauncher {
  private readonly sonner = inject(ZardSonnerService);
  private readonly transloco = inject(TranslocoService);

  open(context: UploadContext = {}): void {
    void context;
    this.sonner.info(this.transloco.translate('pending.upload'));
  }
}

@Injectable({ providedIn: 'root' })
export class PrintLauncher {
  private readonly sonner = inject(ZardSonnerService);
  private readonly transloco = inject(TranslocoService);

  open(context: PrintContext): void {
    void context;
    this.sonner.info(this.transloco.translate('pending.print'));
  }
}
