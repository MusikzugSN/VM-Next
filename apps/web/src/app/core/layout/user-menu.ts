import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideLogOut, lucideScale, lucideShieldCheck, lucideUser } from '@ng-icons/lucide';
import { APP_ROUTES } from '@vm-web/shared';
import { VmMenuImports } from '@vm-web/ui';


import { SessionStore } from '../auth/session.store';
import { BrandingStore, initials } from '../branding/branding.store';

/** Person, own roles, imprint and privacy policy (S-7) and „Abmelden“; in the sidebar (desktop) or as avatar in the header. */
@Component({
  selector: 'vm-user-menu',
  imports: [NgIcon, NgTemplateOutlet, RouterLink, TranslocoPipe, VmMenuImports],
  viewProviders: [provideIcons({ lucideUser, lucideLogOut, lucideScale, lucideShieldCheck })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './user-menu.html',
})
export class UserMenu {
  private readonly session = inject(SessionStore);
  protected readonly branding = inject(BrandingStore);

  readonly variant = input<'sidebar' | 'header'>('header');

  protected readonly profilePath = APP_ROUTES.me.profile;
  /** Imprint and privacy policy (S-7). */
  protected readonly legalDocs = [
    { key: 'imprint', icon: 'lucideScale' },
    { key: 'privacy', icon: 'lucideShieldCheck' },
  ] as const;
  protected readonly user = this.session.user;
  protected readonly userInitials = computed(() => initials(this.user()?.name ?? '?'));
  /** „Notenwart:in · Hauptorchester“ for a single membership, otherwise the role names. */
  protected readonly roleLine = computed(() => {
    const memberships = this.session.memberships();
    if (memberships.length === 1) return `${memberships[0].role.name} · ${memberships[0].ensemble.name}`;
    return [...new Set(memberships.map((m) => m.role.name))].join(', ');
  });

  protected logout(): void {
    void this.session.logout();
  }
}
