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
  templateUrl: './list-state.html',
})
export class ListState {
  readonly list = input.required<CursorList<unknown>>();
  readonly emptyKey = input('common.empty');
}
