import { ChangeDetectionStrategy, Component, effect, input, model, signal, untracked } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { VmInput } from '@vm-web/ui';


import { FormDialog, runDialogSave } from './form-dialog';

/** Max. length of a short name (`shortNameSchema`). */
export const NAME_MAX = 100;

/**
 * Dialog with one name field: create or rename tags, instruments, ensembles, roles.
 * `save` runs the API call (usually via `ActionRunner`) and resolves `true` on success.
 */
@Component({
  selector: 'vm-name-dialog',
  imports: [TranslocoPipe, VmInput, FormDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // The dialog renders in an overlay; its host must not take up space (or a gap) in the page.
  host: { style: 'display: contents' },
  template: `
    <vm-form-dialog
      [(open)]="open"
      [titleKey]="titleKey()"
      [titleParams]="titleParams()"
      [submitKey]="submitKey()"
      [canSubmit]="!!name().trim() && name().trim() !== initial()"
      [busy]="busy()"
      (submitted)="submit()"
    >
      <label class="flex flex-col gap-1.5">
        <span class="font-medium">{{ labelKey() | transloco }}</span>
        <input vm-input cdkFocusInitial type="text" required [maxLength]="max" [value]="name()" (input)="name.set($any($event.target).value)" />
      </label>
    </vm-form-dialog>
  `,
})
export class NameDialog {
  readonly open = model(false);
  readonly titleKey = input.required<string>();
  readonly titleParams = input<Record<string, unknown>>({});
  readonly labelKey = input.required<string>();
  readonly submitKey = input('common.create');
  /** Current name when renaming. */
  readonly initial = input('');
  readonly save = input.required<(name: string) => Promise<boolean>>();

  protected readonly max = NAME_MAX;
  protected readonly name = signal('');
  protected readonly busy = signal(false);

  constructor() {
    effect(() => {
      if (this.open()) untracked(() => this.name.set(this.initial()));
    });
  }

  protected submit(): void {
    const name = this.name().trim();
    if (!name || this.busy()) return;
    void runDialogSave({ busy: this.busy, open: this.open }, () => this.save()(name));
  }
}
