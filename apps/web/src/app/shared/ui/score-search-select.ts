import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucidePlus, lucideSearch } from '@ng-icons/lucide';
import { SCORE_TITLE_MAX, apiUrl, createdResponseSchema, scoreSearchResponseSchema, type ScoreSearchItem } from '@vm-web/shared';
import { of } from 'rxjs';
import { VmInput } from '@vm-web/ui';


import { ActionRunner } from '../../core/actions/action-runner';
import { ApiClient } from '../../core/api/api-client';
import { debounced } from '../../core/util/debounced';

export interface ChosenScore {
  id: string;
  title: string;
}

/**
 * Score assignment for uploads and review (N-11, N-12): shows the chosen score with „Ändern“,
 * otherwise a search over `uploads/score-search` with the hits as buttons.
 */
@Component({
  selector: 'vm-score-search-select',
  imports: [NgIcon, TranslocoPipe, VmInput],
  viewProviders: [provideIcons({ lucideSearch, lucidePlus })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-1.5' },
  templateUrl: './score-search-select.html',
})
export class ScoreSearchSelect {
  private readonly api = inject(ApiClient);

  readonly value = input<ChosenScore | null>(null);
  readonly controlId = input<string | null>(null);
  /** Offers „„<Suche>“ als neues Stück anlegen“ below the hits (N-18, needs `score.create`). */
  readonly allowCreate = input(false);
  readonly changed = output<ChosenScore | null>();
  private readonly actions = inject(ActionRunner);
  protected readonly creating = signal(false);

  protected readonly search = signal('');
  protected readonly query = debounced(this.search);
  protected readonly hits = rxResource({
    params: () => this.query().trim(),
    stream: ({ params }) =>
      params ? this.api.get(apiUrl('uploads', 'scoreSearch'), scoreSearchResponseSchema, { q: params, limit: 8 }) : of({ items: [], nextCursor: null }),
  });

  /** Creates a score with only the title (the rest is filled in later in the library). */
  protected async create(): Promise<void> {
    const title = this.query().trim().slice(0, SCORE_TITLE_MAX);
    if (!title) return;
    const body = { title, composer: null, arranger: null, publisher: null, publisherNumber: null, durationSeconds: null };
    const done = await this.actions.runOnce(() => this.api.post(apiUrl('scores', 'createScore'), body, createdResponseSchema), {
      busy: this.creating,
      success: { key: 'upload.scoreCreated', params: { title } },
    });
    if (done) {
      this.search.set('');
      this.changed.emit({ id: done.value.id, title });
    }
  }

  protected choose(score: ScoreSearchItem): void {
    this.search.set('');
    this.changed.emit({ id: score.id, title: score.title });
  }
}
