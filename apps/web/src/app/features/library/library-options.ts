import { computed, inject, Injectable } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import {
  apiUrl,
  fieldDefinitionsResponseSchema,
  scoreEnsembleOptionsResponseSchema,
  scoreTagOptionsResponseSchema,
} from '@vm-web/shared';

import { ApiClient } from '../../core/api/api-client';
import { SessionStore } from '../../core/auth/session.store';
import { selectOr } from '../../core/util/resource-value';

/**
 * Master data the library pages share: custom fields (N-2), club tags for the score form (N-17)
 * and the ensembles with a lineup for completeness (N-4). Provided per library route, loaded once.
 */
@Injectable()
export class LibraryOptions {
  private readonly api = inject(ApiClient);
  private readonly session = inject(SessionStore);

  private readonly fieldsResource = rxResource({
    stream: () => this.api.get(apiUrl('scores', 'fieldDefinitions'), fieldDefinitionsResponseSchema),
  });
  private readonly tagsResource = rxResource({
    stream: () => this.api.get(apiUrl('scores', 'tagOptions'), scoreTagOptionsResponseSchema),
  });
  private readonly ensemblesResource = rxResource({
    stream: () => this.api.get(apiUrl('scores', 'ensembleOptions'), scoreEnsembleOptionsResponseSchema),
  });

  readonly fields = computed(() => selectOr(this.fieldsResource, (v) => v.items, []));
  readonly fieldsLoaded = computed(() => this.fieldsResource.hasValue());
  readonly tags = computed(() => selectOr(this.tagsResource, (v) => v.items, []));
  readonly ensembles = computed(() => selectOr(this.ensemblesResource, (v) => v.items, []));
  readonly defaultEnsembleId = computed(() =>
    selectOr(this.ensemblesResource, (v) => v.defaultEnsembleId, null),
  );
  /** Creating custom fields: librarians (score.edit) or club configuration (config.edit). */
  readonly canCreateField = computed(() => this.session.can('score.edit') || this.session.can('config.edit'));

  reloadFields(): void {
    this.fieldsResource.reload();
  }

  reloadTags(): void {
    this.tagsResource.reload();
  }
}
