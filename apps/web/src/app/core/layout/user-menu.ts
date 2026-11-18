import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideLogOut, lucideUser } from '@ng-icons/lucide';
import { APP_ROUTES } from '@vm-web/shared';

import { ZardDropdownImports } from '@/shared/components/dropdown/dropdown.imports';

import { SessionStore } from '../auth/session.store';
import { initials } from '../branding/branding.store';

/** Person, own roles and „Abmelden“; in the sidebar (desktop) or as avatar in the header. */
@Component({
  selector: 'vm-user-menu',
  imports: [NgIcon, NgTemplateOutlet, RouterLink, TranslocoPipe, ZardDropdownImports],
  viewProviders: [provideIcons({ lucideUser, lucideLogOut })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (user(); as user) {
      @if (variant() === 'sidebar') {
        <button
          type="button"
          z-dropdown
          [zDropdownMenu]="menu"
          [attr.aria-label]="'shell.userMenu' | transloco: { name: user.name }"
          class="flex w-full items-center gap-2 rounded-md p-2 text-start hover:bg-accent"
        >
          <ng-container [ngTemplateOutlet]="avatar" />
          <span class="flex min-w-0 flex-col">
            <span class="truncate font-medium">{{ user.name }}</span>
            @if (roleLine()) {
              <span class="truncate text-xs text-muted-foreground">{{ roleLine() }}</span>
            }
          </span>
        </button>
      } @else {
        <button
          type="button"
          z-dropdown
          [zDropdownMenu]="menu"
          [attr.aria-label]="'shell.userMenu' | transloco: { name: user.name }"
          class="flex size-11 items-center justify-center rounded-full"
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
            class="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary"
            >{{ userInitials() }}</span
          >
        }
      </ng-template>

      <z-dropdown-menu-content #menu="zDropdownMenuContent" [zSide]="variant() === 'sidebar' ? 'top' : 'bottom'" zAlign="end" class="w-56">
        <z-dropdown-menu-label>
          <span class="block truncate">{{ user.name }}</span>
          @if (user.email) {
            <span class="block truncate text-xs font-normal text-muted-foreground">{{ user.email }}</span>
          }
        </z-dropdown-menu-label>
        <z-dropdown-menu-separator />
        <a z-dropdown-menu-item [routerLink]="profilePath"><ng-icon name="lucideUser" aria-hidden="true" />{{ 'nav.me.profile' | transloco }}</a>
        <button type="button" z-dropdown-menu-item (click)="logout()">
          <ng-icon name="lucideLogOut" aria-hidden="true" />{{ 'common.logout' | transloco }}
        </button>
      </z-dropdown-menu-content>
    }
  `,
})
export class UserMenu {
  private readonly session = inject(SessionStore);

  readonly variant = input<'sidebar' | 'header'>('header');

  protected readonly profilePath = APP_ROUTES.me.profile;
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
