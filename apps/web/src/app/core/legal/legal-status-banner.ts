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
  templateUrl: './legal-status-banner.html',
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
