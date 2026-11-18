import { afterNextRender, inject, Injector } from '@angular/core';

/**
 * After a failed submit, moves the focus to the first invalid field (`aria-invalid="true"`) inside
 * `root`, so keyboard and screen-reader users land where the problem is (WCAG 3.3.1).
 * Call in an injection context once; the returned function runs after the next render.
 */
export function focusFirstInvalid(): (root?: ParentNode) => void {
  const injector = inject(Injector);
  return (root: ParentNode = document) => {
    afterNextRender(
      () => {
        const field = root.querySelector<HTMLElement>('[aria-invalid="true"]');
        if (!field) return;
        const target = field.matches('fieldset') ? field.querySelector<HTMLElement>('input, select, textarea') : field;
        target?.focus();
      },
      { injector },
    );
  };
}
