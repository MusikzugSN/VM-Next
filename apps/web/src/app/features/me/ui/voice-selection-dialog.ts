import { ChangeDetectionStrategy, Component, computed, effect, inject, model, output, signal, untracked } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { PluralPipe } from '../../../core/i18n/plural.pipe';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideSearch } from '@ng-icons/lucide';
import { MAX_PROFILE_VOICES, apiUrl } from '@vm-web/shared';
import { firstValueFrom } from 'rxjs';

import { VmButton, VmDialogImports, VmField, VmFieldLabel, VmInput } from '@vm-web/ui';

import { ApiClient } from '../../../core/api/api-client';
import { ActionRunner } from '../../../core/actions/action-runner';
import { VoiceContextStore } from '../../../core/voices/voice-context.store';
import { filterVoiceGroups } from '../../../core/voices/voice-groups';
import { toggleSetItem } from '../../../core/util/sets';

export { filterVoiceGroups };

/** API limit of `set-voices` (`voiceIds` max. 20). */

/**
 * „Welche Stimmen spielst du?“ (M-1): voices grouped by instrument (N-6) as toggle chips
 * (VoiceChip), search, „Später“ and „Speichern“. Saves the profile voices.
 */
@Component({
  selector: 'vm-voice-selection-dialog',
  imports: [VmField, VmFieldLabel, PluralPipe, NgIcon, TranslocoPipe, VmButton, VmDialogImports, VmInput],
  viewProviders: [provideIcons({ lucideCheck, lucideSearch })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // The dialog renders in an overlay; its host must not take up space (or a gap) in the page.
  host: { style: 'display: contents' },
  templateUrl: './voice-selection-dialog.html',
})
export class VoiceSelectionDialog {
  private readonly api = inject(ApiClient);
  private readonly voices = inject(VoiceContextStore);
  private readonly actions = inject(ActionRunner);

  readonly open = model(false);
  /** „Später“: the dialog does not reopen on its own in this tab. */
  readonly postponed = output<void>();
  readonly saved = output<void>();

  protected readonly search = signal('');
  protected readonly selected = signal<ReadonlySet<string>>(new Set());
  protected readonly saving = signal(false);
  protected readonly groups = computed(() => filterVoiceGroups(this.voices.options(), this.search()));

  constructor() {
    // Start from the current profile voices each time the dialog opens.
    effect(() => {
      if (!this.open()) return;
      untracked(() => {
        this.search.set('');
        this.selected.set(new Set(this.voices.profileVoices().map((voice) => voice.id)));
      });
    });
  }

  protected toggle(id: string): void {
    this.selected.update((current) => toggleSetItem(current, id, MAX_PROFILE_VOICES));
  }

  protected later(): void {
    this.open.set(false);
    this.postponed.emit();
  }

  protected async save(): Promise<void> {
    this.saving.set(true);
    await this.actions.run(async () => {
      await firstValueFrom(this.api.postVoid(apiUrl('me', 'setVoices'), { voiceIds: [...this.selected()] }));
      this.voices.reload();
      this.actions.notify('me.voices.saved');
      this.open.set(false);
      this.saved.emit();
    });
    this.saving.set(false);
  }
}
