import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucidePlus, lucideSearch } from '@ng-icons/lucide';
import { SCORE_TITLE_MAX, apiUrl, createdResponseSchema, scoreSearchResponseSchema, type ScoreSearchItem } from '@vm-web/shared';
import { firstValueFrom, of } from 'rxjs';

import { ZardInputComponent } from '@/shared/components/input';

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
  imports: [NgIcon, TranslocoPipe, ZardInputComponent],
  viewProviders: [provideIcons({ lucideSearch, lucidePlus })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-1.5' },
  template: `
    @if (value(); as chosen) {
      <div class="flex min-h-11 items-center gap-2 rounded-md border border-input px-3 xl:min-h-9">
        <span class="flex-1 truncate font-medium">{{ chosen.title }}</span>
        <button type="button" class="font-medium text-primary underline-offset-4 hover:underline" (click)="changed.emit(null)">
          {{ 'upload.change' | transloco }}
        </button>
      </div>
    } @else {
      <span class="relative">
        <ng-icon name="lucideSearch" class="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input
          z-input
          type="search"
          class="ps-9"
          [id]="controlId()"
          [placeholder]="'upload.searchScore' | transloco"
          [value]="search()"
          (input)="search.set($any($event.target).value)"
          [attr.aria-describedby]="controlId() ? controlId() + '-hits' : null"
        />
      </span>
      @if (query().trim()) {
        <ul [id]="controlId() + '-hits'" class="flex flex-col rounded-md border" [attr.aria-label]="'upload.results' | transloco">
          @if (hits.hasValue()) {
            @for (score of hits.value().items; track score.id; let first = $first) {
              <li [class.border-t]="!first">
                <button type="button" class="flex min-h-11 w-full flex-col items-start px-3 py-1.5 text-start hover:bg-accent xl:min-h-9" (click)="choose(score)">
                  <span class="font-medium">{{ score.title }}</span>
                  @if (score.composer || score.arranger) {
                    <span class="text-xs text-muted-foreground">{{ score.composer ?? score.arranger }}</span>
                  }
                </button>
              </li>
            } @empty {
              <li class="px-3 py-2 text-muted-foreground">{{ 'upload.noScore' | transloco }}</li>
            }
          }
          @if (allowCreate()) {
            <li class="border-t">
              <button
                type="button"
                class="flex min-h-11 w-full items-center gap-2 px-3 py-1.5 text-start font-medium text-primary hover:bg-accent xl:min-h-9"
                [disabled]="creating()"
                (click)="create()"
              >
                <ng-icon name="lucidePlus" aria-hidden="true" />{{ 'upload.createScore' | transloco: { title: query().trim() } }}
              </button>
            </li>
          }
        </ul>
      }
    }
  `,
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
    const done = await this.actions.run(() => firstValueFrom(this.api.post(apiUrl('scores', 'createScore'), body, createdResponseSchema)), {
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
