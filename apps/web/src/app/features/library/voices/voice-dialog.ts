import { ChangeDetectionStrategy, Component, computed, effect, inject, input, model, output, signal, untracked } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowDown, lucideArrowUp, lucideCheck, lucideX } from '@ng-icons/lucide';
import {
  apiUrl,
  createVoiceResponseSchema,
  type VoiceListResponse,
} from '@vm-web/shared';
import { firstValueFrom } from 'rxjs';

import { ZardButtonComponent } from '@/shared/components/button';
import { ZardDialogImports } from '@/shared/components/dialog/dialog.imports';
import { ZardInputComponent } from '@/shared/components/input';
import { ZardNativeSelectDirective } from '@/shared/components/native-select';

import { ActionRunner } from '../../../core/actions/action-runner';
import { focusFirstInvalid } from '../../../core/util/focus-invalid';
import { ApiClient } from '../../../core/api/api-client';
import { isApiProblem } from '../../../core/api/api-problem';
import { instrumentFromVoiceName } from './voice-name';

type Voice = VoiceListResponse['groups'][number]['voices'][number];

/** Voice being edited, or `null` for a new one. */
export interface VoiceDialogTarget {
  voice: Voice;
  instrumentName: string;
}

/** API limit of `set-substitutes`. */
export const MAX_SUBSTITUTES = 10;

/** Moves an item one step up (-1) or down (+1); returns a new array. */
export function moveItem<T>(items: readonly T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  if (target < 0 || target >= items.length) return [...items];
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/**
 * Stimme anlegen/bearbeiten (N-6, N-7, N-9): one field for the full voice name; the instrument follows
 * from it (`instrumentFromVoiceName`) and can be changed via chips or a new name, which creates the
 * instrument. Ordered substitutes with up/down instead of drag & drop.
 */
@Component({
  selector: 'vm-voice-dialog',
  imports: [NgIcon, TranslocoPipe, ZardButtonComponent, ZardDialogImports, ZardInputComponent, ZardNativeSelectDirective],
  viewProviders: [provideIcons({ lucideArrowUp, lucideArrowDown, lucideX, lucideCheck })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // The dialog renders in an overlay; its host must not take up space (or a gap) in the page.
  host: { style: 'display: contents' },
  templateUrl: './voice-dialog.html',
})
export class VoiceDialog {
  private readonly api = inject(ApiClient);
  private readonly actions = inject(ActionRunner);

  readonly open = model(false);
  readonly target = input<VoiceDialogTarget | null>(null);
  /** All voices, for the substitute selection. */
  readonly groups = input.required<VoiceListResponse['groups']>();
  readonly saved = output<void>();

  protected readonly name = signal('');
  /** Instrument chosen by hand; `null` = derived from the voice name. */
  protected readonly override = signal<string | null>(null);
  protected readonly choosing = signal(false);
  protected readonly substitutes = signal<{ id: string; name: string }[]>([]);
  protected readonly errors = signal<Record<string, string>>({});
  private readonly focusInvalid = focusFirstInvalid();
  protected readonly saving = signal(false);
  protected readonly max = MAX_SUBSTITUTES;

  /** Existing instruments in display order. */
  protected readonly instrumentNames = computed(() => this.groups().map((g) => g.instrument.name));
  protected readonly instrument = computed(() => (this.override() ?? instrumentFromVoiceName(this.name(), this.instrumentNames())).trim());
  protected readonly isNewInstrument = computed(() => {
    const current = this.instrument().toLocaleLowerCase('de');
    return !!current && !this.instrumentNames().some((n) => n.toLocaleLowerCase('de') === current);
  });

  /** Voices that can still be added as substitute (not itself, not twice). */
  protected readonly candidates = computed(() => {
    const taken = new Set([this.target()?.voice.id, ...this.substitutes().map((s) => s.id)]);
    return this.groups().map((g) => ({ ...g, voices: g.voices.filter((v) => !taken.has(v.id)) })).filter((g) => g.voices.length);
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      untracked(() => {
        const target = this.target();
        // Editing keeps the current instrument; a new voice derives it from the name.
        this.override.set(target?.instrumentName ?? null);
        this.choosing.set(false);
        this.name.set(target?.voice.name ?? '');
        this.substitutes.set(target?.voice.substitutes.map((s) => ({ id: s.id, name: s.name })) ?? []);
        this.errors.set({});
      });
    });
  }

  protected chooseInstrument(name: string): void {
    this.override.set(name);
    this.choosing.set(false);
  }

  protected addSubstitute(id: string): void {
    if (!id) return;
    const voice = this.groups().flatMap((g) => g.voices).find((v) => v.id === id);
    if (voice && this.substitutes().length < MAX_SUBSTITUTES) this.substitutes.update((list) => [...list, { id: voice.id, name: voice.name }]);
  }

  protected move(index: number, delta: -1 | 1): void {
    this.substitutes.update((list) => moveItem(list, index, delta));
  }

  protected removeSubstitute(index: number): void {
    this.substitutes.update((list) => list.filter((_, i) => i !== index));
  }

  protected async save(): Promise<void> {
    const body = { instrumentName: this.instrument().trim(), name: this.name().trim() };
    const errors: Record<string, string> = {};
    if (!body.instrumentName) errors['instrumentName'] = 'required';
    if (!body.name) errors['name'] = 'required';
    this.errors.set(errors);
    if (Object.keys(errors).length) {
      this.focusInvalid();
      return;
    }

    const target = this.target();
    const onProblem = (problem: unknown) => {
      if (isApiProblem(problem) && problem.code === 'validation-failed') {
        this.errors.set(problem.fieldErrors());
        this.focusInvalid();
        return true;
      }
      return false;
    };
    const done = await this.actions.run(
      async () => {
        let voiceId = target?.voice.id;
        if (voiceId) {
          await firstValueFrom(this.api.postVoid(apiUrl('voices', 'updateVoice', { voiceId }), body));
        } else {
          voiceId = (await firstValueFrom(this.api.post(apiUrl('voices', 'createVoice'), body, createVoiceResponseSchema))).id;
        }
        const substituteVoiceIds = this.substitutes().map((s) => s.id);
        if (target || substituteVoiceIds.length) {
          await firstValueFrom(this.api.postVoid(apiUrl('voices', 'setSubstitutes', { voiceId }), { substituteVoiceIds }));
        }
      },
      { busy: this.saving, success: { key: target ? 'library.voices.saved' : 'library.voices.created', params: { name: body.name } }, onProblem },
    );
    if (done) {
      this.open.set(false);
      this.saved.emit();
    }
  }
}
