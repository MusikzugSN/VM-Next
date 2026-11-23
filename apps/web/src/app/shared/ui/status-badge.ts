import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCircleAlert, lucideCircleCheck, lucideCircleX, lucideClock, lucidePrinter, lucideReplace } from '@ng-icons/lucide';
import { VmBadge, type VmBadgeTone } from '@vm-web/ui';

/** States of the Design Guideline (Statusmuster); the text is the state, colour only the third level. */
export type StatusKind =
  | 'substitute'
  | 'missing'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'queued'
  | 'printing'
  | 'done'
  | 'failed'
  | 'complete';

const STYLES: Record<StatusKind, { tone: VmBadgeTone; icon: string }> = {
  substitute: { tone: 'tertiary', icon: 'lucideReplace' },
  missing: { tone: 'error', icon: 'lucideCircleAlert' },
  pending: { tone: 'warning', icon: 'lucideClock' },
  approved: { tone: 'success', icon: 'lucideCircleCheck' },
  rejected: { tone: 'error', icon: 'lucideCircleX' },
  queued: { tone: 'warning', icon: 'lucideClock' },
  printing: { tone: 'primary', icon: 'lucidePrinter' },
  done: { tone: 'success', icon: 'lucideCircleCheck' },
  failed: { tone: 'error', icon: 'lucideCircleAlert' },
  complete: { tone: 'success', icon: 'lucideCircleCheck' },
};

/** StatusBadge (Design Guideline): icon + word on a container color pair (`vm-badge`). */
@Component({
  selector: 'vm-status-badge',
  imports: [VmBadge, NgIcon, TranslocoPipe],
  viewProviders: [provideIcons({ lucideReplace, lucideCircleAlert, lucideClock, lucideCircleCheck, lucideCircleX, lucidePrinter })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex' },
  template: `
    <span vm-badge [tone]="style().tone">
      <ng-icon [name]="style().icon" size="var(--mat-sys-icon-size-xs)" aria-hidden="true" />
      {{ 'status.' + kind() | transloco: params() }}
    </span>
  `,
})
export class StatusBadge {
  readonly kind = input.required<StatusKind>();
  /** Parameters of the text, e.g. `{ voice: 'Horn in Es' }` for „Ersatz: Horn in Es“. */
  readonly params = input<Record<string, unknown>>({});

  protected readonly style = computed(() => STYLES[this.kind()]);
}
