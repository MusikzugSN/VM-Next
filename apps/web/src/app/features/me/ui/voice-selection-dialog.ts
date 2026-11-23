import { ChangeDetectionStrategy, Component, computed, effect, inject, model, output, signal, untracked } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { PluralPipe } from '../../../core/i18n/plural.pipe';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideSearch } from '@ng-icons/lucide';
import { MAX_PROFILE_VOICES, apiUrl } from '@vm-web/shared';
import { firstValueFrom } from 'rxjs';

import { ZardButtonComponent } from '@vm-web/ui/zard/components/button';
import { ZardDialogImports } from '@vm-web/ui/zard/components/dialog/dialog.imports';
import { ZardInputComponent } from '@vm-web/ui/zard/components/input';

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
  imports: [PluralPipe, NgIcon, TranslocoPipe, ZardButtonComponent, ZardDialogImports, ZardInputComponent],
  viewProviders: [provideIcons({ lucideCheck, lucideSearch })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // The dialog renders in an overlay; its host must not take up space (or a gap) in the page.
  host: { style: 'display: contents' },
  template: `
    <z-dialog [(zVisible)]="open" zWidth="560px">
      <z-dialog-header>
        <h2 z-dialog-title>{{ 'me.voices.title' | transloco }}</h2>
        <p z-dialog-description>{{ 'me.voices.text' | transloco }}</p>
      </z-dialog-header>

      <div class="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto md:max-h-[60dvh] md:flex-none">
        <label class="flex flex-col gap-1.5">
          <span class="font-medium">{{ 'me.voices.search' | transloco }}</span>
          <span class="relative">
            <ng-icon name="lucideSearch" class="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              z-input
              type="search"
              class="ps-9"
              [placeholder]="'me.voices.searchPlaceholder' | transloco"
              [value]="search()"
              (input)="search.set($any($event.target).value)"
            />
          </span>
        </label>

        @for (group of groups(); track group.instrument.id) {
          <div role="group" [attr.aria-labelledby]="'grp-' + group.instrument.id" class="flex flex-col gap-2">
            <span [id]="'grp-' + group.instrument.id" class="text-xs font-medium text-muted-foreground">{{ group.instrument.name }}</span>
            <div class="flex flex-wrap gap-2">
              @for (voice of group.voices; track voice.id) {
                <button
                  type="button"
                  [attr.aria-pressed]="selected().has(voice.id)"
                  (click)="toggle(voice.id)"
                  class="inline-flex h-control items-center gap-1.5 rounded-md border px-3 font-medium xl:h-control-compact"
                  [class]="selected().has(voice.id) ? 'border-primary bg-primary-soft text-primary' : 'border-input bg-background'"
                >
                  @if (selected().has(voice.id)) {
                    <ng-icon name="lucideCheck" aria-hidden="true" />
                  }
                  {{ voice.name }}
                </button>
              }
            </div>
          </div>
        } @empty {
          <p class="text-muted-foreground">{{ 'me.voices.noMatch' | transloco }}</p>
        }
      </div>

      <z-dialog-footer class="flex-col-reverse items-stretch gap-2 md:flex-row md:items-center">
        <span class="text-muted-foreground md:me-auto" aria-live="polite">{{ 'me.voices.count' | tPlural: selected().size }}</span>
        <button z-button zType="secondary" type="button" (click)="later()">{{ 'me.voices.later' | transloco }}</button>
        <button z-button type="button" [zLoading]="saving()" [zDisabled]="selected().size === 0 || saving()" (click)="save()">
          {{ 'common.save' | transloco }}
        </button>
      </z-dialog-footer>
    </z-dialog>
  `,
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
