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
  template: `
    <div class="flex min-h-dvh flex-col">
      <header class="flex h-header shrink-0 items-center gap-3 border-b px-4 md:px-8">
        <vm-club-logo [size]="32" />
        <span class="font-semibold">{{ clubName() }}</span>
      </header>
      <main class="flex flex-1 items-start justify-center p-4 md:items-center md:p-8">
        <section vm-card class="flex w-full max-w-dialog-md flex-col gap-6 p-6 md:p-8">
          <span class="flex size-12 items-center justify-center rounded-full bg-destructive-soft text-destructive-ink">
            <ng-icon name="lucideLock" size="var(--mat-sys-icon-size-md)" aria-hidden="true" />
          </span>
          <div class="flex flex-col gap-2">
            <h1 class="text-headline-small">{{ 'auth.blocked.title' | transloco }}</h1>
            <p class="text-muted-foreground">{{ 'auth.blocked.text' | transloco: { club: clubName() } }}</p>
          </div>
          <div class="flex flex-col gap-2 rounded-small border p-4">
            <h2 class="font-semibold">{{ 'auth.blocked.contactTitle' | transloco }}</h2>
            <p class="text-muted-foreground">{{ 'auth.blocked.contactText' | transloco }}</p>
          </div>
          <div class="flex justify-end">
            <a vm-button variant="outlined" [routerLink]="loginPath" class="w-full md:w-auto">
              <ng-icon name="lucideLogIn" aria-hidden="true" />{{ 'auth.blocked.otherAccount' | transloco }}
            </a>
          </div>
        </section>
      </main>
      <vm-legal-links />
    </div>
  `,
})
export class BlockedPage {
  private readonly branding = inject(BrandingStore);
  protected readonly loginPath = APP_ROUTES.login;
  protected readonly clubName = computed(() => this.branding.clubName() ?? 'VM-Web');
}
