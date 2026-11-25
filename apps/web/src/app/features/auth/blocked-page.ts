import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideLock, lucideLogIn } from '@ng-icons/lucide';
import { APP_ROUTES } from '@vm-web/shared';

import { VmButton, VmCard } from '@vm-web/ui';

import { BrandingStore } from '../../core/branding/branding.store';
import { ClubLogo } from '../../core/branding/club-logo';
import { LegalLinks } from '../../core/legal/legal-links';

/**
 * Konto gesperrt (A-5). The API creates no session for blocked accounts, so there is no
 * „Abmelden“; signing in with another account is offered instead.
 */
@Component({
  selector: 'vm-blocked-page',
  imports: [VmCard, RouterLink, TranslocoPipe, NgIcon, VmButton, ClubLogo, LegalLinks],
  viewProviders: [provideIcons({ lucideLock, lucideLogIn })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './blocked-page.html',
})
export class BlockedPage {
  private readonly branding = inject(BrandingStore);
  protected readonly loginPath = APP_ROUTES.login;
  protected readonly clubName = computed(() => this.branding.clubName() ?? 'VM-Web');
}
