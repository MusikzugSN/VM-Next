import { ChangeDetectionStrategy, Component, effect, input, output, signal, untracked } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucidePlus } from '@ng-icons/lucide';
import type { ScoreCandidate } from '@vm-web/shared';
import { of, type Observable } from 'rxjs';

import { ZardButtonComponent } from '@vm-web/ui/zard/components/button';
import { ZardInputComponent } from '@vm-web/ui/zard/components/input';

import { debounced } from '../../../core/util/debounced';
import { SearchField } from '../../../shared/ui/search-field';
import { selectOr } from '../../../core/util/resource-value';

export interface CandidatePage {
  items: ScoreCandidate[];
  /** Folders only: proposal for the next free number (N-5). */
  suggestedNumber?: string | null;
}

export interface PickedScore {
  score: ScoreCandidate;
  /** Folder number, if `numbered`. */
  number: string;
}

/**
 * „Stück hinzufügen“ for folders and setlists: search the library, add with one click.
 * Scores already contained are shown but cannot be added again.
 */
@Component({
  selector: 'vm-score-picker',
  imports: [NgIcon, TranslocoPipe, ZardButtonComponent, ZardInputComponent, SearchField],
  viewProviders: [provideIcons({ lucidePlus })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-3' },
  template: `
    <div class="flex flex-col gap-3 md:flex-row md:items-end">
      <vm-search-field [(value)]="search" labelKey="library.picker.search" [hideLabel]="false" [focusInDialog]="true" />
      @if (numbered()) {
        <label class="flex flex-col gap-1.5 md:w-32">
          <span class="font-medium">{{ 'library.picker.number' | transloco }}</span>
          <input z-input type="text" maxlength="10" [value]="number()" (input)="number.set($any($event.target).value)" />
        </label>
      }
    </div>

    @if (query().trim()) {
      @if (results.hasValue()) {
        <ul class="flex flex-col" [attr.aria-label]="'library.picker.results' | transloco">
          @for (score of results.value().items; track score.id; let first = $first) {
            <li class="flex min-h-target items-center gap-3 py-1" [class.border-t]="!first">
              <span class="flex min-w-0 flex-1 flex-col">
                <span class="font-medium">{{ score.title }}</span>
                @if (score.composer) {
                  <span class="text-muted-foreground">{{ score.composer }}</span>
                }
              </span>
              @if (score.alreadyContained) {
                <span class="text-xs text-muted-foreground">{{ 'library.picker.contained' | transloco }}</span>
              } @else {
                <button
                  z-button
                  zType="outline"
                  type="button"
                  [zDisabled]="numbered() && !number().trim()"
                  (click)="pick(score)"
                  [attr.aria-label]="'library.picker.addLabel' | transloco: { title: score.title }"
                >
                  <ng-icon name="lucidePlus" aria-hidden="true" />{{ 'library.picker.add' | transloco }}
                </button>
              }
            </li>
          } @empty {
            <li class="text-muted-foreground">{{ 'library.picker.none' | transloco }}</li>
          }
        </ul>
      } @else if (results.isLoading()) {
        <p class="text-muted-foreground">{{ 'common.loading' | transloco }}</p>
      }
    }
  `,
})
export class ScorePicker {
  /** Loads candidates for a search text. */
  readonly fetch = input.required<(q: string) => Observable<CandidatePage>>();
  readonly numbered = input(false);
  readonly picked = output<PickedScore>();

  protected readonly search = signal('');
  protected readonly query = debounced(this.search);
  protected readonly number = signal('');

  protected readonly results = rxResource({
    params: () => ({ q: this.query().trim(), fetch: this.fetch() }),
    stream: ({ params }) => (params.q ? params.fetch(params.q) : of<CandidatePage>({ items: [] })),
  });

  constructor() {
    // Take over the suggested folder number after each search, unless typed by hand.
    effect(() => {
      const suggested = selectOr(this.results, (v) => v.suggestedNumber, null);
      if (suggested && !untracked(this.number).trim()) this.number.set(suggested);
    });
  }

  protected pick(score: ScoreCandidate): void {
    this.picked.emit({ score, number: this.number().trim() });
    this.number.set('');
    this.results.reload();
  }
}
