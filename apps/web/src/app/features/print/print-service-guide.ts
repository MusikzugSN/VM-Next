import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCopy, lucideRepeat, lucideTriangleAlert } from '@ng-icons/lucide';

import { VmButton, VmToastService } from '@vm-web/ui';

import type { PrintServiceIssue } from '../../core/print/print-service-client';

/**
 * Why the local print service isn't usable and how to set it up (docs/print-service.md): shown
 * inline wherever that matters, today the print-history page and the print dialog's fallback case.
 */
@Component({
  selector: 'vm-print-service-guide',
  imports: [NgIcon, TranslocoPipe, VmButton],
  viewProviders: [provideIcons({ lucideTriangleAlert, lucideCopy, lucideRepeat })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './print-service-guide.html',
})
export class PrintServiceGuide {
  private readonly sonner = inject(VmToastService);
  private readonly transloco = inject(TranslocoService);

  readonly state = input.required<PrintServiceIssue>();
  readonly recheck = output<void>();

  protected readonly origin = typeof location === 'undefined' ? '' : location.origin;

  protected async copyOrigin(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.origin);
      this.sonner.success(this.transloco.translate('print.history.copied'));
    } catch {
      // Clipboard blocked: the address is visible on the page anyway.
    }
  }
}
