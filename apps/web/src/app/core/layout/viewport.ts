import { BreakpointObserver } from '@angular/cdk/layout';
import { computed, inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

/** Breakpoints of the Design Guideline (`bp-tablet`, `bp-desktop`); same as Tailwind `md` and `xl`. */
export const BREAKPOINTS = { tablet: 768, desktop: 1280 } as const;

export type Viewport = 'mobile' | 'tablet' | 'desktop';

const DESKTOP_QUERY = `(min-width: ${BREAKPOINTS.desktop}px)`;
const TABLET_QUERY = `(min-width: ${BREAKPOINTS.tablet}px)`;

/**
 * Current layout class as a signal. For CSS-only differences use Tailwind (`md:`, `xl:`);
 * use this where the mockups show different markup (table vs. cards, sidebar vs. sheet).
 */
@Injectable({ providedIn: 'root' })
export class ViewportService {
  private readonly observer = inject(BreakpointObserver);

  readonly viewport = toSignal(
    this.observer.observe([TABLET_QUERY, DESKTOP_QUERY]).pipe(map(() => this.current())),
    { initialValue: this.current() },
  );
  readonly isMobile = computed(() => this.viewport() === 'mobile');
  readonly isDesktop = computed(() => this.viewport() === 'desktop');

  private current(): Viewport {
    if (this.observer.isMatched(DESKTOP_QUERY)) return 'desktop';
    if (this.observer.isMatched(TABLET_QUERY)) return 'tablet';
    return 'mobile';
  }
}
