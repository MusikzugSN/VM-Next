import { DestroyRef, effect, inject, Injectable, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { TitleStrategy, type ActivatedRouteSnapshot, type RouterStateSnapshot } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';

import { BrandingStore } from '../branding/branding.store';

/**
 * Route data of a page: i18n keys of its title, of its area and – for detail pages – of the list
 * it belongs to (breadcrumbs „Noten / Mappen verwalten / Frühjahrskonzert“).
 */
export interface PageData {
  readonly titleKey: string;
  readonly sectionKey?: string;
  readonly sectionPath?: string;
  readonly parentKey?: string;
  readonly parentPath?: string;
}

export type Crumb = { key: string; path: string };

/** Title and breadcrumb data for a route: `{ title: 'nav.me.start', ...page('nav.me.start', …) }`. */
export function page(titleKey: string, section?: Crumb, parent?: Crumb) {
  const data: PageData = { titleKey, sectionKey: section?.key, sectionPath: section?.path, parentKey: parent?.key, parentPath: parent?.path };
  return { title: titleKey, data };
}

/** The current page as signals, for the header (title, breadcrumbs). */
@Injectable({ providedIn: 'root' })
export class CurrentPage {
  readonly data = signal<PageData | null>(null);
  /** Name of the shown element on detail pages (folder, score, user …), set via `usePageName`. */
  readonly name = signal<string | null>(null);
}

/**
 * Shows the name of the loaded element as page title: last breadcrumb, header title on tablet and
 * phone, and document title „<Name> · <Verein>“. Call in the constructor of a detail page.
 */
export function usePageName(name: () => string | null | undefined): void {
  const current = inject(CurrentPage);
  const title = inject(Title);
  const branding = inject(BrandingStore);
  const transloco = inject(TranslocoService);
  effect(() => {
    const value = name()?.trim() || null;
    current.name.set(value);
    if (value) title.setTitle(`${value} · ${branding.clubName() ?? transloco.translate<string>('app.name')}`);
  });
  inject(DestroyRef).onDestroy(() => current.name.set(null));
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
