import { ChangeDetectionStrategy, Component, computed, effect, inject, model, signal, untracked } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideSearch } from '@ng-icons/lucide';

import { VmButton, VmDialogImports, VmField, VmFieldLabel, VmInput } from '@vm-web/ui';

import { VoiceContextStore } from '../voices/voice-context.store';
import { filterVoiceGroups } from '../voices/voice-groups';

/**
 * „Andere Stimme“ (M-2): any voice for Mein Bereich, e.g. to stand in for someone. Only the
 * browser tab switches (VoiceContextStore override); the profile voices stay as they are.
 */
@Component({
  selector: 'vm-stand-in-dialog',
  imports: [VmField, VmFieldLabel, NgIcon, TranslocoPipe, VmButton, VmDialogImports, VmInput],
  viewProviders: [provideIcons({ lucideCheck, lucideSearch })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // The dialog renders in an overlay; its host must not take up space in the header.
  host: { style: 'display: contents' },
  templateUrl: './stand-in-dialog.html',
})
export class StandInDialog {
  private readonly voices = inject(VoiceContextStore);

  readonly open = model(false);

  protected readonly search = signal('');
  protected readonly groups = computed(() => filterVoiceGroups(this.voices.options(), this.search()));
  /** The single voice shown right now, if the tab switched to one. */
  protected readonly current = computed(() => {
    const ids = this.voices.overrideIds();
    return ids.length === 1 ? ids[0] : null;
  });

  constructor() {
    effect(() => {
      if (this.open()) untracked(() => this.search.set(''));
    });
  }

  protected choose(voiceId: string): void {
    this.voices.setOverride([voiceId]);
    this.open.set(false);
  }
}
