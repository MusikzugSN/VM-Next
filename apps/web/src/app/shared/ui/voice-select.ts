import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { VmSelect } from '@vm-web/ui';


import { VoiceContextStore } from '../../core/voices/voice-context.store';

/** Voice picker grouped by instrument (N-6); options from `me/voice-options`. */
@Component({
  selector: 'vm-voice-select',
  imports: [TranslocoPipe, VmSelect],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './voice-select.html',
})
export class VoiceSelect {
  protected readonly voices = inject(VoiceContextStore);

  readonly value = input<string | null>(null);
  readonly controlId = input<string | null>(null);
  readonly invalid = input(false);
  readonly describedBy = input<string | null>(null);
  readonly changed = output<string | null>();
}
