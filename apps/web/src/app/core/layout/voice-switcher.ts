import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronDown, lucideMusic2 } from '@ng-icons/lucide';
import { APP_ROUTES } from '@vm-web/shared';
import { VmMenuImports } from '@vm-web/ui';


import { VoiceContextStore } from '../voices/voice-context.store';
import { StandInDialog } from './stand-in-dialog';

/**
 * Active voice in the header (M-2): shows the voices of Mein Bereich, switches between the own
 * voices or to any other voice („Aushilfe“) without changing the profile.
 */
@Component({
  selector: 'vm-voice-switcher',
  imports: [NgIcon, RouterLink, TranslocoPipe, VmMenuImports, StandInDialog],
  viewProviders: [provideIcons({ lucideMusic2, lucideChevronDown })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './voice-switcher.html',
})
export class VoiceSwitcher {
  protected readonly store = inject(VoiceContextStore);
  protected readonly profilePath = APP_ROUTES.me.profile;
  protected readonly standInOpen = signal(false);

  /** Own voices, plus the voice of a stand-in so that the menu shows it as selected (M-2). */
  protected readonly menuVoices = computed(() => {
    const own = this.store.profileVoices();
    const ownIds = new Set(own.map((voice) => voice.id));
    return [...own, ...this.store.activeVoices().filter((voice) => !ownIds.has(voice.id))];
  });

  protected readonly label = computed(() =>
    this.store
      .activeVoices()
      .map((voice) => voice.name)
      .join(', '),
  );

  /** Radio value: '' = all own voices, otherwise the single overriding voice. */
  protected readonly selected = computed(() => {
    const ids = this.store.overrideIds();
    return ids.length === 1 ? ids[0] : '';
  });

  protected select(value: string | undefined): void {
    if (value) this.store.setOverride([value]);
    else this.store.clearOverride();
  }
}
