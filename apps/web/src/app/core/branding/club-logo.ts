import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import { BrandingStore } from './branding.store';

/** Club logo from the configuration (S-4), otherwise the initials on brass. Decorative unless `label` is set. */
@Component({
  selector: 'vm-club-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex shrink-0' },
  templateUrl: './club-logo.html',
})
export class ClubLogo {
  protected readonly branding = inject(BrandingStore);

  readonly size = input(32);
  /** Accessible name, e.g. „Vereinslogo Musikzug Musterstadt“; without it the logo is decorative. */
  readonly label = input<string | null>(null);

  protected readonly fontSize = computed(() => Math.round(this.size() * 0.4));
  protected readonly radius = computed(() => Math.round(this.size() / 4));
}
