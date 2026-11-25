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
  templateUrl: './dependencies-page.html',
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
