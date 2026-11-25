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
  template: `
    @if (user(); as user) {
      @if (variant() === 'sidebar') {
        <button
          type="button"
          vm-menu-trigger
          [zDropdownMenu]="menu"
          [attr.aria-label]="'shell.userMenu' | transloco: { name: user.name }"
          class="flex w-full items-center gap-2 rounded-small p-2 text-start hover:bg-on-surface/8"
        >
          <ng-container [ngTemplateOutlet]="avatar" />
          <span class="flex min-w-0 flex-col">
            <span class="truncate font-medium">{{ user.name }}</span>
            @if (roleLine()) {
              <span class="truncate text-body-small text-muted-foreground">{{ roleLine() }}</span>
            }
          </span>
        </button>
      } @else {
        <button
          type="button"
          vm-menu-trigger
          [zDropdownMenu]="menu"
          [attr.aria-label]="'shell.userMenu' | transloco: { name: user.name }"
          class="flex size-control items-center justify-center rounded-full"
        >
          <ng-container [ngTemplateOutlet]="avatar" />
        </button>
      }

      <ng-template #avatar>
        @if (user.pictureUrl) {
          <img [src]="user.pictureUrl" alt="" class="size-8 shrink-0 rounded-full object-cover" />
        } @else {
          <span
            aria-hidden="true"
            class="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-label-medium text-primary font-semibold"
            >{{ userInitials() }}</span
          >
        }
      </ng-template>

      <vm-menu-content #menu="zDropdownMenuContent" [zSide]="variant() === 'sidebar' ? 'top' : 'bottom'" zAlign="end" class="w-56">
        <vm-menu-label>
          <span class="block truncate">{{ user.name }}</span>
          @if (user.email) {
            <span class="block truncate text-body-small text-muted-foreground">{{ user.email }}</span>
          }
        </vm-menu-label>
        <vm-menu-separator />
        <a vm-menu-item [routerLink]="profilePath"><ng-icon name="lucideUser" aria-hidden="true" />{{ 'nav.me.profile' | transloco }}</a>
        @if (branding.branding(); as b) {
          <vm-menu-separator />
          @for (doc of legalDocs; track doc.key) {
            @let link = b[doc.key];
            @if (link.kind === 'external') {
              <a vm-menu-item [href]="link.href"><ng-icon [name]="doc.icon" aria-hidden="true" />{{ 'legal.' + doc.key | transloco }}</a>
            } @else {
              <a vm-menu-item [routerLink]="link.href"><ng-icon [name]="doc.icon" aria-hidden="true" />{{ 'legal.' + doc.key | transloco }}</a>
            }
          }
          <vm-menu-separator />
        }
        <button type="button" vm-menu-item (click)="logout()">
          <ng-icon name="lucideLogOut" aria-hidden="true" />{{ 'common.logout' | transloco }}
        </button>
      </vm-menu-content>
    }
  `,
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
