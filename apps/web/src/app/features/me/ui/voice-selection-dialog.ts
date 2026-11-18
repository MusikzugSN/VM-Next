import { ChangeDetectionStrategy, Component, computed, effect, inject, model, output, signal, untracked } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { PluralPipe } from '../../../core/i18n/plural.pipe';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideSearch } from '@ng-icons/lucide';
import { apiUrl, type VoiceOptionsResponse } from '@vm-web/shared';
import { firstValueFrom } from 'rxjs';

import { ZardButtonComponent } from '@/shared/components/button';
import { ZardDialogImports } from '@/shared/components/dialog/dialog.imports';
import { ZardInputComponent } from '@/shared/components/input';
import { ZardSonnerService } from '@/shared/components/sonner';

import { ApiClient } from '../../../core/api/api-client';
import { isApiProblem } from '../../../core/api/api-problem';
import { VoiceContextStore } from '../../../core/voices/voice-context.store';

/** API limit of `set-voices` (`voiceIds` max. 20). */
export const MAX_PROFILE_VOICES = 20;

type Group = VoiceOptionsResponse['groups'][number];

/** Groups whose instrument or voice name contains the search text (case-insensitive). */
export function filterVoiceGroups(groups: readonly Group[], search: string): Group[] {
  const needle = search.trim().toLocaleLowerCase('de');
  if (!needle) return [...groups];
  return groups
    .map((group) =>
      group.instrument.name.toLocaleLowerCase('de').includes(needle)
        ? group
        : { ...group, voices: group.voices.filter((voice) => voice.name.toLocaleLowerCase('de').includes(needle)) },
    )
    .filter((group) => group.voices.length > 0);
}

/**
 * „Welche Stimmen spielst du?“ (M-1): voices grouped by instrument (N-6) as toggle chips
 * (VoiceChip), search, „Später“ and „Speichern“. Saves the profile voices.
 */
@Component({
  selector: 'vm-voice-selection-dialog',
  imports: [PluralPipe, NgIcon, TranslocoPipe, ZardButtonComponent, ZardDialogImports, ZardInputComponent],
  viewProviders: [provideIcons({ lucideCheck, lucideSearch })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <z-dialog [(zVisible)]="open" zWidth="560px">
      <z-dialog-header>
        <h2 z-dialog-title>{{ 'me.voices.title' | transloco }}</h2>
        <p z-dialog-description>{{ 'me.voices.text' | transloco }}</p>
      </z-dialog-header>

      <div class="flex max-h-[60dvh] flex-col gap-4 overflow-y-auto px-1">
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
                  class="inline-flex h-11 items-center gap-1.5 rounded-md border px-3 font-medium xl:h-9"
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
  private readonly sonner = inject(ZardSonnerService);
  private readonly transloco = inject(TranslocoService);

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
    this.selected.update((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_PROFILE_VOICES) next.add(id);
      return next;
    });
  }

  protected later(): void {
    this.open.set(false);
    this.postponed.emit();
  }

  protected async save(): Promise<void> {
    this.saving.set(true);
    try {
      await firstValueFrom(this.api.postVoid(apiUrl('me', 'setVoices'), { voiceIds: [...this.selected()] }));
      this.voices.reload();
      this.sonner.success(this.transloco.translate('me.voices.saved'));
      this.open.set(false);
      this.saved.emit();
    } catch (error) {
      this.sonner.error(this.transloco.translate(isApiProblem(error) ? error.messageKey : 'errors.unknown'));
    } finally {
      this.saving.set(false);
    }
  }
}
