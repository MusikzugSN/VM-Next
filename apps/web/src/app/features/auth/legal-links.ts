import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

import { BrandingStore } from '../../core/branding/branding.store';

/** Imprint and privacy links from the configuration (S-4); hidden while not configured. */
@Component({
  selector: 'vm-legal-links',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @if (branding.branding(); as b) {
      @if (b.imprintUrl || b.privacyUrl) {
        <footer class="flex min-h-14 items-center justify-center gap-2 text-[13px] text-muted-foreground">
          @if (b.imprintUrl) {
            <a [href]="b.imprintUrl" class="inline-flex min-h-11 items-center px-1">{{ 'auth.legal.imprint' | transloco }}</a>
          }
          @if (b.imprintUrl && b.privacyUrl) {
            <span aria-hidden="true">·</span>
          }
          @if (b.privacyUrl) {
            <a [href]="b.privacyUrl" class="inline-flex min-h-11 items-center px-1">{{ 'auth.legal.privacy' | transloco }}</a>
          }
        </footer>
      }
    }
  `,
})
export class LegalLinks {
  protected readonly branding = inject(BrandingStore);
}
