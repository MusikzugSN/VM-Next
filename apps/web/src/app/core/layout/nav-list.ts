import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCalendar,
  lucideCalendarCog,
  lucideClock,
  lucideFolderCog,
  lucideFolderOpen,
  lucideHouse,
  lucideMusic,
  lucideMusic2,
  lucideNetwork,
  lucidePrinter,
  lucideSettings,
  lucideShieldCheck,
  lucideTag,
  lucideTags,
  lucideUpload,
  lucideUser,
  lucideUsers,
} from '@ng-icons/lucide';

import { SessionStore } from '../auth/session.store';
import { ReviewCountStore } from '../review/review-count.store';
import { filter, map } from 'rxjs';

import { canSee, isActive, NAV_SECTIONS } from './nav';

/** Main navigation (sidebar on desktop, sheet on tablet/phone). Entries without permission are hidden, not disabled. */
@Component({
  selector: 'vm-nav-list',
  imports: [RouterLink, NgIcon, TranslocoPipe],
  viewProviders: [
    provideIcons({
      lucideHouse,
      lucideFolderOpen,
      lucideCalendar,
      lucideTag,
      lucideMusic,
      lucideClock,
      lucideFolderCog,
      lucideCalendarCog,
      lucideTags,
      lucideUpload,
      lucideUser,
      lucideMusic2,
      lucidePrinter,
      lucideUsers,
      lucideNetwork,
      lucideShieldCheck,
      lucideSettings,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './nav-list.html',
})
export class NavList {
  private readonly session = inject(SessionStore);
  private readonly review = inject(ReviewCountStore);

  /** Emitted when an entry is chosen, so a sheet can close. */
  readonly navigate = output<void>();

  private readonly router = inject(Router);
  /** Current URL; detail pages keep their list entry active (e.g. a folder under „Mappen“). */
  protected readonly url = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );
  protected readonly isActive = isActive;

  protected readonly reviewCount = this.review.pending;
  protected readonly sections = computed(() => {
    const check = { isMember: this.session.isMember(), can: (p: Parameters<SessionStore['can']>[0]) => this.session.can(p) };
    return NAV_SECTIONS.map((section) => ({ ...section, items: section.items.filter((item) => canSee(item.access, check)) })).filter(
      (section) => section.items.length > 0,
    );
  });
}
