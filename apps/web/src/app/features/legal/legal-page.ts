import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { apiUrl, DEFAULT_APP_PATH, publicLegalDocumentResponseSchema, type LegalDocument } from '@vm-web/shared';

import { ApiClient } from '../../core/api/api-client';
import { BrandingStore } from '../../core/branding/branding.store';
import { ClubLogo } from '../../core/branding/club-logo';
import { LegalHtml } from '../../core/legal/legal-html';
import { LegalLinks } from '../../core/legal/legal-links';
import { PageProblem } from '../../shared/ui/page-problem';

/**
 * Impressum and Datenschutzerklärung (S-7): public, without navigation, only club name and logo.
 * Mode `link` forwards to the external URL; incomplete documents show a neutral notice.
 */
@Component({
  selector: 'vm-legal-page',
  imports: [RouterLink, TranslocoPipe, ClubLogo, LegalHtml, LegalLinks, PageProblem],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './legal-page.html',
})
export class LegalPage {
  private readonly api = inject(ApiClient);
  private readonly location = inject(DOCUMENT).location;
  private readonly branding = inject(BrandingStore);

  /** Route data. */
  readonly document = input.required<LegalDocument>();

  protected readonly homePath = DEFAULT_APP_PATH;
  protected readonly clubName = computed(() => this.branding.clubName() ?? 'VM-Web');
  protected readonly doc = rxResource({
    params: () => this.document(),
    stream: ({ params }) => this.api.get(apiUrl('publicLegal', params), publicLegalDocumentResponseSchema),
  });

  constructor() {
    // Mode `link`: the route forwards to the external page (S-7).
    effect(() => {
      const d = this.doc.hasValue() ? this.doc.value() : undefined;
      if (d?.mode === 'link') this.location.replace(d.url);
    });
  }
}
