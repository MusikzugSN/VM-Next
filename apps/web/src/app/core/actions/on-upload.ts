import { effect, inject, untracked } from '@angular/core';

import { UploadLauncher } from './pending-features';

/** Runs `reload` after each finished upload (not on creation). Call in an injection context. */
export function onUploadCompleted(reload: () => void): void {
  const launcher = inject(UploadLauncher);
  const start = launcher.completed();
  effect(() => {
    if (launcher.completed() !== start) untracked(reload);
  });
}
