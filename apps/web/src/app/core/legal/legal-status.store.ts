import { computed, inject, Injectable } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { apiUrl, legalStatusResponseSchema } from '@vm-web/shared';

import { ApiClient } from '../api/api-client';
import { SessionStore } from '../auth/session.store';
import { valueOr } from '../util/resource-value';

/**
 * Whether imprint and privacy policy are published (S-7), for the warnings in the configuration
 * and on the admin start page. Only loaded for people with the configuration permission.
 */
@Injectable({ providedIn: 'root' })
export class LegalStatusStore {
  private readonly api = inject(ApiClient);
  private readonly session = inject(SessionStore);

  private readonly resource = rxResource({
    params: () => (this.session.can('config.view') ? true : undefined),
    stream: () => this.api.get(apiUrl('system', 'legalStatus'), legalStatusResponseSchema),
  });

  readonly status = computed(() => valueOr(this.resource, null));
  /** Documents that are not (completely) set up and therefore not published. */
  readonly unpublished = computed(() => {
    const s = this.status();
    return s ? (['imprint', 'privacy'] as const).filter((d) => s[d] !== 'published') : [];
  });
  readonly templateUpdateAvailable = computed(() => this.status()?.templateUpdateAvailable ?? false);

  reload(): void {
    this.resource.reload();
  }
}
