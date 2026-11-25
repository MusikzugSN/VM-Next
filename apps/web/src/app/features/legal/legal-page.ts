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
  template: `
    <div class="flex min-h-dvh flex-col bg-background">
      <header class="flex h-header shrink-0 items-center gap-3 border-b px-4 md:px-8 print:border-b-0 print:px-0">
        <a [routerLink]="homePath" class="flex min-w-0 items-center gap-3 text-foreground no-underline">
          <vm-club-logo [size]="32" />
          <span class="truncate font-semibold">{{ clubName() }}</span>
        </a>
      </header>
      <main class="flex flex-1 justify-center px-4 py-8 md:px-8 md:py-12 print:p-0">
        <article class="w-full max-w-[72ch]">
          @if (doc.error()) {
            <vm-page-problem [error]="doc.error()" />
          } @else if (doc.hasValue() && doc.value(); as d) {
            @switch (d.mode) {
              @case ('generated') {
                <vm-legal-html [html]="d.html" />
              }
              @case ('link') {
                <p class="text-muted-foreground" role="status">{{ 'legal.page.redirecting' | transloco }}</p>
                <a [href]="d.url">{{ d.url }}</a>
              }
              @default {
                <h1 class="text-headline-small">{{ 'legal.' + document() | transloco }}</h1>
                <p class="mt-4 text-muted-foreground">{{ 'legal.page.unavailable' | transloco: { club: clubName() } }}</p>
              }
            }
          } @else {
            <p class="text-muted-foreground" role="status">{{ 'common.loading' | transloco }}</p>
          }
        </article>
      </main>
      <vm-legal-links class="border-t" />
    </div>
  `,
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
