import { computed, inject, Injectable } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { apiUrl, reviewQueueResponseSchema } from '@vm-web/shared';

import { ApiClient } from '../api/api-client';
import { SessionStore } from '../auth/session.store';

/** Number of uploads waiting for review, for the badge at „Prüfung“ (N-12); only with `sheet.approve`. */
@Injectable({ providedIn: 'root' })
export class ReviewCountStore {
  private readonly api = inject(ApiClient);
  private readonly session = inject(SessionStore);

  private readonly resource = rxResource({
    params: () => (this.session.can('sheet.approve') ? true : undefined),
    stream: () => this.api.get(apiUrl('review', 'queue'), reviewQueueResponseSchema, { limit: 1 }),
  });

  readonly pending = computed(() => (this.resource.hasValue() ? this.resource.value().totalPending : 0));

  /** After an approval, rejection or own upload. */
  refresh(): void {
    this.resource.reload();
  }
}
