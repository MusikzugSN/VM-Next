import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCircleAlert, lucideInfo, lucideLogIn } from '@ng-icons/lucide';
import { apiUrl, loginErrorCodeSchema, problemCodeSchema } from '@vm-web/shared';

import { VmButton } from '@vm-web/ui';

import { safeReturnTo } from '../../core/auth/guards';
import { BrandingStore } from '../../core/branding/branding.store';
import { ClubLogo } from '../../core/branding/club-logo';
import { ViewportService } from '../../core/layout/viewport';
import { LegalLinks } from './legal-links';

/** i18n key for `?error=` on the login page: login errors from the callback or API problem codes. */
export function loginErrorKey(code: string | undefined): string | null {
  if (!code) return null;
  if (loginErrorCodeSchema.safeParse(code).success) return `errors.login.${code}`;
  if (problemCodeSchema.safeParse(code).success || code === 'network-error') return `errors.${code}`;
  return 'errors.unknown';
}

/** Anmeldung (A-1, A-2): club logo and banner, „Mit Vereinskonto anmelden“, optional direct redirect. */
@Component({
  selector: 'vm-login-page',
  imports: [NgTemplateOutlet, TranslocoPipe, NgIcon, VmButton, ClubLogo, LegalLinks],
  viewProviders: [provideIcons({ lucideLogIn, lucideInfo, lucideCircleAlert })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-template #welcome>
      <section
        [attr.aria-label]="'auth.login.welcomeLabel' | transloco"
        class="flex flex-col gap-3 rounded-lg bg-primary-soft px-4 py-5 text-primary md:flex-1 md:justify-between md:gap-0 md:rounded-none md:p-12 xl:p-16"
      >
        <div class="hidden items-center gap-3 md:flex">
          <vm-club-logo [size]="32" />
          <span class="font-semibold">{{ clubName() }}</span>
        </div>
        <div class="flex max-w-[520px] flex-col gap-3 md:gap-5">
          <div aria-hidden="true" class="flex w-30 flex-col gap-1.5 md:w-60 md:gap-2">
            @for (line of staffLines; track line) {
              <div class="h-px bg-primary/25"></div>
            }
          </div>
          <p class="text-title-large leading-6 md:text-headline-large md:leading-10">
            {{ 'auth.login.welcome' | transloco: { club: clubName() } }}
          </p>
          <p class="text-body-large whitespace-pre-line md:text-body-large md:leading-6">
            {{ branding.branding()?.loginBanner ?? ('auth.login.defaultBanner' | transloco) }}
          </p>
        </div>
        <p class="hidden text-body-medium md:block">{{ 'auth.login.tagline' | transloco }}</p>
      </section>
    </ng-template>

    <div class="flex min-h-dvh flex-col md:flex-row">
      @if (!viewport.isMobile()) {
        <ng-container [ngTemplateOutlet]="welcome" />
      }

      <section class="flex flex-1 flex-col md:w-[min(640px,50%)] md:flex-none md:p-8">
        <main class="flex flex-1 flex-col px-4 pt-12 pb-4 md:items-center md:justify-center md:p-0">
          <div class="flex w-full flex-1 flex-col gap-6 md:max-w-dialog-sm md:flex-none md:items-center md:text-center">
            <div class="flex flex-col items-center gap-4 text-center md:gap-6">
              <vm-club-logo [size]="logoSize()" [label]="'auth.login.logoLabel' | transloco: { club: clubName() }" />
              <div class="flex flex-col gap-1">
                <h1 class="text-title-large leading-7 md:text-headline-small md:leading-8">{{ clubName() }}</h1>
                <p class="hidden text-muted-foreground md:block">{{ 'auth.login.intro' | transloco }}</p>
              </div>
            </div>

            @if (viewport.isMobile()) {
              <ng-container [ngTemplateOutlet]="welcome" />
            }

            @if (errorKey(); as key) {
              <p role="alert" class="flex items-start gap-2 rounded-md bg-destructive-soft p-4 text-start text-destructive-ink">
                <ng-icon name="lucideCircleAlert" class="mt-0.5 shrink-0" aria-hidden="true" />{{ key | transloco }}
              </p>
            }

            <div class="mt-auto flex w-full flex-col gap-3 md:mt-0">
              <a vm-button [href]="loginHref()" class="w-full">
                <ng-icon name="lucideLogIn" aria-hidden="true" />{{ 'auth.login.submit' | transloco }}
              </a>
              <p class="flex items-start gap-2 text-start text-body-medium text-muted-foreground">
                <ng-icon name="lucideInfo" class="mt-0.5 shrink-0" aria-hidden="true" />{{ 'auth.login.redirectHint' | transloco }}
              </p>
            </div>
          </div>
        </main>
        <vm-legal-links class="border-t md:border-t-0" />
      </section>
    </div>
  `,
})
export class LoginPage {
  private readonly document = inject(DOCUMENT);
  protected readonly branding = inject(BrandingStore);
  protected readonly viewport = inject(ViewportService);

  /** Query parameters (router input binding). */
  readonly returnTo = input<string>();
  readonly error = input<string>();

  protected readonly staffLines = [1, 2, 3, 4, 5];
  protected readonly clubName = computed(() => this.branding.clubName() ?? 'VM-Web');
  protected readonly logoSize = computed(() => (this.viewport.isMobile() ? 80 : 96));
  protected readonly errorKey = computed(() => loginErrorKey(this.error()));
  protected readonly loginHref = computed(() => {
    const returnTo = safeReturnTo(this.returnTo());
    const base = apiUrl('auth', 'login');
    return returnTo ? `${base}?returnTo=${encodeURIComponent(returnTo)}` : base;
  });

  constructor() {
    // A-2: go straight to the identity server, unless the last attempt failed (no redirect loop).
    effect(() => {
      if (this.branding.branding()?.autoRedirect && !this.error()) this.document.location.assign(this.loginHref());
    });
  }
}
