import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

import { VmButton } from '@vm-web/ui';

import type { CursorList } from '../../core/api/cursor-list';

/** Loading, error, empty state and „Mehr laden“ below a cursor list. */
@Component({
  selector: 'vm-list-state',
  imports: [TranslocoPipe, VmButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // empty:hidden – without state or button the host must not add a gap to the page.
  host: { class: 'flex flex-col gap-3 empty:hidden' },
  template: `
    @if (list().error(); as error) {
      <div role="alert" class="flex flex-col items-start gap-2 rounded-md bg-destructive-soft p-4 text-destructive-ink md:flex-row md:items-center">
        <span class="flex-1">{{ error.messageKey | transloco }}</span>
        <button vm-button variant="outlined" type="button" (click)="list().reload()">{{ 'common.retry' | transloco }}</button>
      </div>
    } @else if (list().loaded() && list().items().length === 0) {
      <p class="rounded-lg border border-dashed p-8 text-center text-muted-foreground">{{ emptyKey() | transloco }}</p>
    } @else if (!list().loaded() && list().loading()) {
      <p class="p-4 text-center text-muted-foreground" aria-live="polite">{{ 'common.loading' | transloco }}</p>
    }
    @if (list().hasMore() && !list().error()) {
      <button vm-button variant="outlined" type="button" class="w-full md:w-auto md:self-center" [zLoading]="list().loading()" (click)="list().loadMore()">
        {{ 'common.loadMore' | transloco }}
      </button>
    }
  `,
})
export class ListState {
  readonly list = input.required<CursorList<unknown>>();
  readonly emptyKey = input('common.empty');
}
