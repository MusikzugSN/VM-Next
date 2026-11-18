import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import { BrandingStore } from './branding.store';

/** Club logo from the configuration (S-4), otherwise the initials on brass. Decorative unless `label` is set. */
@Component({
  selector: 'vm-club-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex shrink-0' },
  template: `
    @if (branding.logoUrl(); as logo) {
      <img [src]="logo" [alt]="label() ?? ''" [style.width.px]="size()" [style.height.px]="size()" class="object-contain" />
    } @else {
      <span
        [attr.role]="label() ? 'img' : null"
        [attr.aria-label]="label()"
        [attr.aria-hidden]="label() ? null : 'true'"
        [style.width.px]="size()"
        [style.height.px]="size()"
        [style.font-size.px]="fontSize()"
        [style.border-radius.px]="radius()"
        class="flex items-center justify-center bg-brass font-semibold text-foreground"
        >{{ branding.initials() }}</span
      >
    }
  `,
})
export class ClubLogo {
  protected readonly branding = inject(BrandingStore);

  readonly size = input(32);
  /** Accessible name, e.g. „Vereinslogo Musikzug Musterstadt“; without it the logo is decorative. */
  readonly label = input<string | null>(null);

  protected readonly fontSize = computed(() => Math.round(this.size() * 0.4));
  protected readonly radius = computed(() => Math.round(this.size() / 4));
}
