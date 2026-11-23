import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCircleCheck, lucideLock } from '@ng-icons/lucide';
import type { UserStatus } from '@vm-web/shared';

/** Aktiv / Gesperrt (S-1, A-5) with icon and word. */
@Component({
  selector: 'vm-user-status-badge',
  imports: [NgIcon, TranslocoPipe],
  viewProviders: [provideIcons({ lucideCircleCheck, lucideLock })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex' },
  template: `
    @if (status() === 'active') {
      <span class="inline-flex items-center gap-1 rounded-sm bg-success-soft px-2 py-0.5 text-xs font-medium text-success-ink">
        <ng-icon name="lucideCircleCheck" size="var(--mat-sys-icon-size-xs)" aria-hidden="true" />{{ 'system.users.active' | transloco }}
      </span>
    } @else {
      <span class="inline-flex items-center gap-1 rounded-sm bg-destructive-soft px-2 py-0.5 text-xs font-medium text-destructive-ink">
        <ng-icon name="lucideLock" size="var(--mat-sys-icon-size-xs)" aria-hidden="true" />{{ 'system.users.blocked' | transloco }}
      </span>
    }
  `,
})
export class UserStatusBadge {
  readonly status = input.required<UserStatus>();
}
