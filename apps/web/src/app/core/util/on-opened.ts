import { effect, untracked, type Signal } from '@angular/core';

/**
 * Runs `reset` each time a dialog opens. Signals read in `reset` are not tracked, so later
 * changes to them do not reset the dialog again. Call it in an injection context.
 */
export function onOpened(open: Signal<boolean>, reset: () => void): void {
  effect(() => {
    if (open()) untracked(reset);
  });
}
