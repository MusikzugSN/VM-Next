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
  template: `
    <vm-dialog [(zVisible)]="open" zWidth="560px">
      <vm-dialog-header>
        <h2 vm-dialog-title>{{ 'shell.voice.standInTitle' | transloco }}</h2>
        <p vm-dialog-description>{{ 'shell.voice.standInText' | transloco }}</p>
      </vm-dialog-header>

      <div class="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto md:max-h-[60dvh] md:flex-none">
        <label vm-field>
          <span vm-field-label>{{ 'shell.voice.search' | transloco }}</span>
          <span class="relative">
            <ng-icon name="lucideSearch" class="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              vm-input
              type="search"
              class="ps-9"
              [placeholder]="'shell.voice.searchPlaceholder' | transloco"
              [value]="search()"
              (input)="search.set($any($event.target).value)"
            />
          </span>
        </label>

        @for (group of groups(); track group.instrument.id) {
          <div role="group" [attr.aria-labelledby]="'stand-in-' + group.instrument.id" class="flex flex-col gap-2">
            <span [id]="'stand-in-' + group.instrument.id" class="text-xs font-medium text-muted-foreground">{{ group.instrument.name }}</span>
            <div class="flex flex-wrap gap-2">
              @for (voice of group.voices; track voice.id) {
                <button
                  type="button"
                  [attr.aria-pressed]="voice.id === current()"
                  (click)="choose(voice.id)"
                  class="inline-flex h-control items-center gap-1.5 rounded-md border px-3 font-medium xl:h-control-compact"
                  [class]="voice.id === current() ? 'border-primary bg-primary-soft text-primary' : 'border-input bg-background'"
                >
                  @if (voice.id === current()) {
                    <ng-icon name="lucideCheck" aria-hidden="true" />
                  }
                  {{ voice.name }}
                </button>
              }
            </div>
          </div>
        } @empty {
          <p class="text-muted-foreground">{{ 'shell.voice.noMatch' | transloco }}</p>
        }
      </div>

      <vm-dialog-footer>
        <button vm-button variant="tonal" type="button" (click)="open.set(false)">{{ 'common.cancel' | transloco }}</button>
      </vm-dialog-footer>
    </vm-dialog>
  `,
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
