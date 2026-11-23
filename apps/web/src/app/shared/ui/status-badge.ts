import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCircleAlert, lucideCircleCheck, lucideCircleX, lucideClock, lucidePrinter, lucideReplace } from '@ng-icons/lucide';

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

const STYLES: Record<StatusKind, { tone: string; icon: string }> = {
  substitute: { tone: 'bg-brass-soft text-brass-ink', icon: 'lucideReplace' },
  missing: { tone: 'bg-destructive-soft text-destructive-ink', icon: 'lucideCircleAlert' },
  pending: { tone: 'bg-warning-soft text-warning-ink', icon: 'lucideClock' },
  approved: { tone: 'bg-success-soft text-success-ink', icon: 'lucideCircleCheck' },
  rejected: { tone: 'bg-destructive-soft text-destructive-ink', icon: 'lucideCircleX' },
  queued: { tone: 'bg-warning-soft text-warning-ink', icon: 'lucideClock' },
  printing: { tone: 'bg-primary-soft text-primary', icon: 'lucidePrinter' },
  done: { tone: 'bg-success-soft text-success-ink', icon: 'lucideCircleCheck' },
  failed: { tone: 'bg-destructive-soft text-destructive-ink', icon: 'lucideCircleAlert' },
  complete: { tone: 'bg-success-soft text-success-ink', icon: 'lucideCircleCheck' },
};

/** StatusBadge (Design Guideline): icon + word on a `*-soft` surface with `*-ink` text. */
@Component({
  selector: 'vm-status-badge',
  imports: [NgIcon, TranslocoPipe],
  viewProviders: [provideIcons({ lucideReplace, lucideCircleAlert, lucideClock, lucideCircleCheck, lucideCircleX, lucidePrinter })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex' },
  template: `
    <span class="inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-medium whitespace-nowrap {{ style().tone }}">
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
