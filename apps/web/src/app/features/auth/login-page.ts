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
import { LegalLinks } from '../../core/legal/legal-links';

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
  templateUrl: './login-page.html',
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
