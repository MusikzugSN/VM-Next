import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideTriangleAlert } from '@ng-icons/lucide';
import { APP_ROUTES } from '@vm-web/shared';

import { LegalStatusStore } from './legal-status.store';

/**
 * Warning for admins while imprint or privacy policy are not published, or a new template
 * waits to be accepted (S-7). Shown on the configuration page and the start page.
 */
@Component({
  selector: 'vm-legal-status-banner',
  imports: [RouterLink, TranslocoPipe, NgIcon],
  viewProviders: [provideIcons({ lucideTriangleAlert })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    @if (missing().length || legal.templateUpdateAvailable()) {
      <div class="flex flex-col gap-2 rounded-medium border border-warning-ink/30 bg-warning-soft p-4 text-warning-ink md:flex-row md:items-center md:justify-between" role="alert">
        <p class="flex items-start gap-2">
          <ng-icon name="lucideTriangleAlert" class="mt-0.5 shrink-0" size="var(--mat-sys-icon-size-md)" aria-hidden="true" />
          <span>
            @if (missing().length) {
              <strong class="block">{{ titleKey() | transloco }}</strong>
              {{ (missing().length === 2 ? 'legal.warning.both' : 'legal.warning.' + missing()[0]) | transloco }}
            } @else {
              <strong class="block">{{ 'legal.warning.templateTitle' | transloco }}</strong>
              {{ 'legal.warning.template' | transloco }}
            }
          </span>
        </p>
        @if (showLink()) {
          <a [routerLink]="settingsPath" [queryParams]="{ tab: 'legal' }" class="shrink-0 font-medium text-warning-ink">{{ 'legal.warning.action' | transloco }}</a>
        }
      </div>
    }
  `,
})
export class LegalStatusBanner {
  protected readonly legal = inject(LegalStatusStore);

  /** Link to the tab „Rechtliches“ (not needed on that tab itself). */
  readonly showLink = input(true);

  protected readonly settingsPath = APP_ROUTES.system.settings;
  protected readonly missing = computed(() => this.legal.unpublished());
  protected readonly titleKey = computed(() => {
    const missing = this.missing();
    if (missing.length !== 1) return 'legal.warning.title';
    return missing[0] === 'imprint' ? 'legal.warning.titleImprint' : 'legal.warning.titlePrivacy';
  });
}
