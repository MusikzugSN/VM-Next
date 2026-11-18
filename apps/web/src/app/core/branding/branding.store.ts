import { computed, inject, Injectable } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { apiUrl, loginPageResponseSchema } from '@vm-web/shared';

import { ApiClient } from '../api/api-client';

/** Club name, logo, banner and legal links (S-4); public, loaded once per page load. */
@Injectable({ providedIn: 'root' })
export class BrandingStore {
  private readonly api = inject(ApiClient);

  private readonly resource = rxResource({
    stream: () => this.api.get(apiUrl('auth', 'loginPage'), loginPageResponseSchema),
  });

  readonly branding = computed(() => (this.resource.hasValue() ? this.resource.value() : null));
  readonly loading = this.resource.isLoading;
  readonly clubName = computed(() => this.branding()?.clubName ?? null);
  readonly logoUrl = computed(() => this.branding()?.logoUrl ?? null);
  /** Two letters for the logo placeholder, e.g. „Musikzug Musterstadt“ → „MM“. */
  readonly initials = computed(() => initials(this.clubName() ?? 'VM-Web'));
}

export function initials(name: string): string {
  const words = name
    .split(/[\s-]+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean);
  const letters = words.length >= 2 ? words[0][0] + words[words.length - 1][0] : (words[0] ?? '?').slice(0, 2);
  return letters.toUpperCase();
}
