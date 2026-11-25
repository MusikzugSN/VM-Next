import { FOLDER_NUMBER_MAX } from '@vm-web/shared';
import { ChangeDetectionStrategy, Component, effect, input, output, signal, untracked } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucidePlus } from '@ng-icons/lucide';
import type { ScoreCandidate } from '@vm-web/shared';
import { of, type Observable } from 'rxjs';

import { VmButton, VmField, VmFieldLabel, VmInput } from '@vm-web/ui';

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
  imports: [VmField, VmFieldLabel, NgIcon, TranslocoPipe, VmButton, VmInput, SearchField],
  viewProviders: [provideIcons({ lucidePlus })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-3' },
  templateUrl: './score-picker.html',
})
export class ScorePicker {
  /** Loads candidates for a search text. */
  readonly fetch = input.required<(q: string) => Observable<CandidatePage>>();
  readonly numbered = input(false);
  readonly picked = output<PickedScore>();

  protected readonly search = signal('');
  protected readonly numberMax = FOLDER_NUMBER_MAX;
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
