import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { APP_ROUTES } from '@vm-web/shared';

import { BrandingStore } from '../branding/branding.store';

/**
 * Imprint and privacy links (S-4, S-7) on the login page, in the app footer and on public pages.
 * Mode `link` goes straight to the external URL, otherwise to `/impressum` and `/datenschutz`.
 * „Abhängigkeiten“ (third-party packages and licenses) is always linked.
 */
@Component({
  selector: 'vm-legal-links',
  imports: [RouterLink, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block print:hidden' },
  templateUrl: './legal-links.html',
})
export class LegalLinks {
  protected readonly branding = inject(BrandingStore);
  protected readonly docs = ['imprint', 'privacy'] as const;
  protected readonly dependenciesPath = APP_ROUTES.dependencies;
}
