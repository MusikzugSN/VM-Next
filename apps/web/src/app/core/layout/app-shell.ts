import { DOCUMENT } from '@angular/common';
import { afterNextRender, ChangeDetectionStrategy, Component, computed, DestroyRef, inject, Injector, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCalendar, lucideFolderOpen, lucideHouse, lucideMenu, lucideUser } from '@ng-icons/lucide';
import { APP_ROUTES } from '@vm-web/shared';
import { filter, skip } from 'rxjs';

import { ZardSheetImports } from '@/shared/components/sheet/sheet.imports';
import { ZardSonnerComponent } from '@/shared/components/sonner';

import { UploadDialog } from '../../features/uploads/upload-dialog';
import { BrandingStore } from '../branding/branding.store';
import { ClubLogo } from '../branding/club-logo';
import { ViewportService } from './viewport';
import { MOBILE_NAV } from './nav';
import { NavList } from './nav-list';
import { CurrentPage } from './page';
import { UserMenu } from './user-menu';
import { VoiceSwitcher } from './voice-switcher';

/**
 * Frame of every signed-in page (Design Guideline, Layout & Responsivität):
 * - desktop (≥ 1280 px): fixed sidebar, header with breadcrumbs and active voice;
 * - tablet: header with menu button, page title, voice and avatar; navigation as sheet;
 * - phone (< 768 px): like tablet plus bottom bar (Start, Mappen, Events, Profil).
 */
@Component({
  selector: 'vm-app-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    NgIcon,
    TranslocoPipe,
    ZardSheetImports,
    ClubLogo,
    NavList,
    UserMenu,
    VoiceSwitcher,
    UploadDialog,
    ZardSonnerComponent,
  ],
  viewProviders: [provideIcons({ lucideMenu, lucideHouse, lucideFolderOpen, lucideCalendar, lucideUser })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app-shell.html',
})
export class AppShell {
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);

  protected readonly viewport = inject(ViewportService);
  protected readonly branding = inject(BrandingStore);
  protected readonly page = inject(CurrentPage).data;
  protected readonly mobileNav = MOBILE_NAV;
  protected readonly navOpen = signal(false);

  /** On phones the active voice sits above the content of Mein Bereich (mockup „Start · Mobil“). */
  private readonly url = signal(this.router.url);
  protected readonly showMobileVoice = computed(
    () => this.viewport.isMobile() && (this.url() === APP_ROUTES.me.root || this.url().startsWith(`${APP_ROUTES.me.root}/`)),
  );

  constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((event) => {
        this.url.set(event.urlAfterRedirects.split('?')[0]);
        this.navOpen.set(false);
      });

    // Focus the page heading after each navigation (not the first), so screen readers announce the new page.
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        skip(1),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe(() => afterNextRender(() => this.focusHeading(), { injector: this.injector }));
  }

  /**
   * Focuses the page's h1. Pages that load their data first render the h1 a bit later, so wait
   * for it (up to 3 s) before falling back to `main`. Stops when the person moved the focus.
   */
  private focusHeading(): void {
    const main = this.document.getElementById('main');
    if (!main) return;
    const focus = (target: HTMLElement) => {
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    };
    const heading = main.querySelector<HTMLElement>('h1');
    if (heading) return focus(heading);

    const startedOn = this.document.activeElement;
    const observer = new MutationObserver(() => {
      const late = main.querySelector<HTMLElement>('h1');
      if (!late) return;
      stop();
      if (this.document.activeElement === startedOn || this.document.activeElement === this.document.body) focus(late);
    });
    const timer = setTimeout(() => {
      stop();
      if (this.document.activeElement === startedOn || this.document.activeElement === this.document.body) focus(main);
    }, 3000);
    const stop = () => {
      observer.disconnect();
      clearTimeout(timer);
    };
    observer.observe(main, { childList: true, subtree: true });
  }
}
