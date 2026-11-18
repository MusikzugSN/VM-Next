import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

import { ZardNativeSelectDirective } from '@/shared/components/native-select';

import { VoiceContextStore } from '../../core/voices/voice-context.store';

/** Voice picker grouped by instrument (N-6); options from `me/voice-options`. */
@Component({
  selector: 'vm-voice-select',
  imports: [TranslocoPipe, ZardNativeSelectDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <select
      z-native-select
      [id]="controlId()"
      [value]="value() ?? ''"
      (change)="changed.emit($any($event.target).value || null)"
      [attr.aria-invalid]="invalid() ? 'true' : null"
      [attr.aria-describedby]="describedBy()"
    >
      <option value="">{{ 'upload.chooseVoice' | transloco }}</option>
      @for (group of voices.options(); track group.instrument.id) {
        <optgroup [label]="group.instrument.name">
          @for (voice of group.voices; track voice.id) {
            <option [value]="voice.id" [selected]="voice.id === value()">{{ voice.name }}</option>
          }
        </optgroup>
      }
    </select>
  `,
})
export class VoiceSelect {
  protected readonly voices = inject(VoiceContextStore);

  readonly value = input<string | null>(null);
  readonly controlId = input<string | null>(null);
  readonly invalid = input(false);
  readonly describedBy = input<string | null>(null);
  readonly changed = output<string | null>();
}
