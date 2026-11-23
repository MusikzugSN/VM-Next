import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

import { VmButton } from '@vm-web/ui';
import { ZardDialogImports } from '@vm-web/ui/zard/components/dialog/dialog.imports';

let nextId = 0;

/**
 * Frame of every create/add/edit dialog: title, scrolling form body, footer with „Abbrechen“ and
 * the submit button. Full screen on phones, centered panel from md on (see `dialogVariants`).
 * Mark the first field with `cdkFocusInitial`, so the focus starts there instead of on „Schließen“.
 */
@Component({
  selector: 'vm-form-dialog',
  imports: [TranslocoPipe, VmButton, ZardDialogImports],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // The dialog renders in an overlay; its host must not take up space (or a gap) in the page.
  host: { style: 'display: contents' },
  template: `
    <z-dialog [(zVisible)]="open" [zWidth]="width()" [zMaskClosable]="!busy()">
      <z-dialog-header>
        <h2 z-dialog-title>{{ titleKey() | transloco: titleParams() }}</h2>
        @if (descriptionKey(); as description) {
          <p z-dialog-description>{{ description | transloco: titleParams() }}</p>
        }
      </z-dialog-header>

      <form
        [id]="formId"
        class="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto md:max-h-[65dvh] md:flex-none"
        novalidate
        (submit)="$event.preventDefault(); submitted.emit()"
      >
        <ng-content />
      </form>

      <z-dialog-footer>
        <button vm-button variant="tonal" type="button" (click)="open.set(false)">{{ (submitKey() ? 'common.cancel' : 'common.close') | transloco }}</button>
        @if (submitKey(); as submit) {
          <button vm-button type="submit" [attr.form]="formId" [zLoading]="busy()" [zDisabled]="busy() || !canSubmit()">{{ submit | transloco }}</button>
        }
      </z-dialog-footer>
    </z-dialog>
  `,
})
export class FormDialog {
  readonly open = model(false);
  readonly titleKey = input.required<string>();
  readonly titleParams = input<Record<string, unknown>>({});
  readonly descriptionKey = input<string | null>(null);
  /** Text of the submit button; `null` hides it (e.g. pickers that act on every click). */
  readonly submitKey = input<string | null>('common.save');
  readonly canSubmit = input(true);
  readonly busy = input(false);
  /** Width from md on, e.g. `'32rem'`. */
  readonly width = input<string | undefined>(undefined);
  readonly submitted = output<void>();

  protected readonly formId = `vm-form-dialog-${++nextId}`;
}

/**
 * Runs the save callback of a dialog: busy while running, closes the dialog on success.
 * Failures stay in the dialog (the callback shows the toast via `ActionRunner`).
 */
export async function runDialogSave(state: { busy: { set(v: boolean): void }; open: { set(v: boolean): void } }, save: () => Promise<boolean>): Promise<void> {
  state.busy.set(true);
  try {
    if (await save()) state.open.set(false);
  } finally {
    state.busy.set(false);
  }
}
