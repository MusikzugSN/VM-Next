import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCircleCheck, lucideLock } from '@ng-icons/lucide';
import type { UserStatus } from '@vm-web/shared';
import { VmBadge } from '@vm-web/ui';

/** Aktiv / Gesperrt (S-1, A-5) with icon and word. */
@Component({
  selector: 'vm-user-status-badge',
  imports: [VmBadge, NgIcon, TranslocoPipe],
  viewProviders: [provideIcons({ lucideCircleCheck, lucideLock })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex' },
  templateUrl: './user-status-badge.html',
})
export class UserStatusBadge {
  readonly status = input.required<UserStatus>();
}
