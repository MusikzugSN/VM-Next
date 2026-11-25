import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideExternalLink, lucideSearch } from '@ng-icons/lucide';
import { DEFAULT_APP_PATH } from '@vm-web/shared';

import { VmCard, VmField, VmFieldLabel, VmInput, VmTable } from '@vm-web/ui';

import { BrandingStore } from '../../core/branding/branding.store';
import { ClubLogo } from '../../core/branding/club-logo';
import { LegalLinks } from '../../core/legal/legal-links';

/** One installed third-party package, from `dependencies.json` (generated at build time, `web:licenses`). */
export interface DependencyEntry {
  readonly name: string;
  readonly version: string;
  readonly license: string;
  readonly url: string;
}

/** Packages whose name or license contains the search text (case-insensitive). */
export function filterDependencies(packages: readonly DependencyEntry[], search: string): readonly DependencyEntry[] {
  const term = search.trim().toLowerCase();
  if (!term) return packages;
  return packages.filter((p) => p.name.toLowerCase().includes(term) || p.license.toLowerCase().includes(term));
}

/**
 * Abhängigkeiten: VM-Web's own license, its source code and all third-party runtime packages with
 * version and license. Public, without navigation, like the legal pages (S-7).
 */
@Component({
  selector: 'vm-dependencies-page',
  imports: [RouterLink, TranslocoPipe, NgIcon, VmCard, VmField, VmFieldLabel, VmInput, VmTable, ClubLogo, LegalLinks],
  viewProviders: [provideIcons({ lucideExternalLink, lucideSearch })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex min-h-dvh flex-col bg-background">
      <header class="flex h-header shrink-0 items-center gap-3 border-b px-4 md:px-8">
        <a [routerLink]="homePath" class="flex min-w-0 items-center gap-3 text-foreground no-underline">
          <vm-club-logo [size]="32" />
          <span class="truncate font-semibold">{{ clubName() }}</span>
        </a>
      </header>
      <main class="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 md:px-8 md:py-12">
        <div class="flex flex-col gap-2">
          <h1 class="text-headline-small">{{ 'legal.dependencies' | transloco }}</h1>
          <p>
            {{ 'legal.dependenciesPage.ownBefore' | transloco }}
            <a href="https://www.gnu.org/licenses/gpl-3.0.html" target="_blank" rel="noopener noreferrer" class="underline">{{
              'legal.dependenciesPage.ownLicense' | transloco
            }}</a
            >{{ 'legal.dependenciesPage.ownAfter' | transloco }}
            {{ 'legal.dependenciesPage.sourceBefore' | transloco }}
            <a [href]="repositoryUrl" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 underline"
              >{{ 'legal.dependenciesPage.source' | transloco
              }}<ng-icon name="lucideExternalLink" class="shrink-0" size="var(--mat-sys-icon-size-xs)" aria-hidden="true" /></a
            >.
          </p>
          <p class="text-muted-foreground">{{ 'legal.dependenciesPage.intro' | transloco }}</p>
        </div>

        @if (list.error()) {
          <p role="alert" class="text-destructive-ink">{{ 'legal.dependenciesPage.error' | transloco }}</p>
        } @else if (list.isLoading()) {
          <p class="text-muted-foreground" role="status">{{ 'common.loading' | transloco }}</p>
        } @else {
          <label vm-field class="max-w-md">
            <span vm-field-label>{{ 'legal.dependenciesPage.search' | transloco }}</span>
            <span class="relative">
              <ng-icon name="lucideSearch" class="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input
                vm-input
                type="search"
                class="ps-9"
                [placeholder]="'legal.dependenciesPage.searchPlaceholder' | transloco"
                [value]="search()"
                (input)="search.set($any($event.target).value)"
              />
            </span>
          </label>
          <p class="text-body-medium text-muted-foreground" aria-live="polite">
            {{ 'legal.dependenciesPage.count' | transloco: { shown: shown().length, total: packages().length } }}
          </p>
          @if (shown().length > 0) {
            <div vm-card class="overflow-x-auto">
              <table vm-table>
                <thead>
                  <tr>
                    <th scope="col" class="px-4 py-3 text-start">{{ 'legal.dependenciesPage.name' | transloco }}</th>
                    <th scope="col" class="w-32 px-4 py-3 text-start">{{ 'legal.dependenciesPage.version' | transloco }}</th>
                    <th scope="col" class="w-48 px-4 py-3 text-start">{{ 'legal.dependenciesPage.license' | transloco }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (p of shown(); track p.name + '@' + p.version) {
                    <tr>
                      <td class="px-4 py-3">
                        <a
                          [href]="p.url"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="inline-flex items-center gap-1 font-medium break-all"
                          [attr.aria-label]="'legal.dependenciesPage.linkLabel' | transloco: { name: p.name }"
                          >{{ p.name }}<ng-icon name="lucideExternalLink" class="shrink-0 text-muted-foreground" size="var(--mat-sys-icon-size-xs)" aria-hidden="true"
                        /></a>
                      </td>
                      <td class="px-4 py-3 tabular-nums">{{ p.version }}</td>
                      <td class="px-4 py-3 text-muted-foreground">{{ p.license }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          } @else {
            <p class="text-muted-foreground">{{ 'legal.dependenciesPage.empty' | transloco }}</p>
          }
        }
      </main>
      <vm-legal-links class="border-t" />
    </div>
  `,
})
export class DependenciesPage {
  private readonly branding = inject(BrandingStore);
  /** Source code of VM-Web (GPL-3.0: the source must be available to users). */
  protected readonly repositoryUrl = 'https://github.com/MusikzugSN/VM-Next';
  protected readonly homePath = DEFAULT_APP_PATH;
  protected readonly clubName = computed(() => this.branding.clubName() ?? 'VM-Web');

  protected readonly list = httpResource<{ packages: DependencyEntry[] }>(() => '/dependencies.json');
  protected readonly packages = computed(() => (this.list.hasValue() ? this.list.value().packages : []));
  protected readonly search = signal('');
  protected readonly shown = computed(() => filterDependencies(this.packages(), this.search()));
}
