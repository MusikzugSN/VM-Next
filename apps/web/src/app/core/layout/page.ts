import { inject, Injectable, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { TitleStrategy, type ActivatedRouteSnapshot, type RouterStateSnapshot } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';

import { BrandingStore } from '../branding/branding.store';

/** Route data of a page: i18n keys of its title and of its area (for breadcrumbs). */
export interface PageData {
  readonly titleKey: string;
  readonly sectionKey?: string;
  readonly sectionPath?: string;
}

/** Title and breadcrumb data for a route: `{ title: 'nav.me.start', ...page('nav.me.start', …) }`. */
export function page(titleKey: string, section?: { key: string; path: string }) {
  const data: PageData = { titleKey, sectionKey: section?.key, sectionPath: section?.path };
  return { title: titleKey, data };
}

/** The current page as signals, for the header (title, breadcrumbs). */
@Injectable({ providedIn: 'root' })
export class CurrentPage {
  readonly data = signal<PageData | null>(null);
}

/**
 * Document title „<Seite> · <Verein>“ from the route's i18n key (WCAG 2.4.2), and the current
 * page for the header. Titles use global keys only, so they are available on every page.
 */
@Injectable()
export class AppTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly transloco = inject(TranslocoService);
  private readonly branding = inject(BrandingStore);
  private readonly current = inject(CurrentPage);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const data = deepestPageData(snapshot.root);
    this.current.data.set(data);
    const key = this.buildTitle(snapshot);
    const suffix: string = this.branding.clubName() ?? this.transloco.translate<string>('app.name');
    this.title.setTitle(key ? `${this.transloco.translate<string>(key)} · ${suffix}` : suffix);
  }
}

function deepestPageData(route: ActivatedRouteSnapshot): PageData | null {
  let found: PageData | null = null;
  for (let node: ActivatedRouteSnapshot | null = route; node; node = node.firstChild) {
    const data = node.data as Partial<PageData>;
    if (typeof data.titleKey === 'string') found = data as PageData;
  }
  return found;
}
