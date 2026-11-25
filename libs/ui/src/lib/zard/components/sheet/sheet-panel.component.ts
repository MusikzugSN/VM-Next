import { FocusTrapFactory } from '@angular/cdk/a11y';
import {
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  ViewEncapsulation,
} from '@angular/core';

import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';
import type { ClassValue } from 'clsx';

import { VmIconButton } from '@vm-web/ui/button/vm-button';
import { mergeClasses } from '@vm-web/ui/zard/utils/merge-classes';

import { sheetVariants, type ZardSheetVariants } from './sheet.variants';

export const SHEET_DURATION = 200;

export type ZardSheetSide = NonNullable<ZardSheetVariants['zSide']>;
export type ZardSheetSize = NonNullable<ZardSheetVariants['zSize']>;

@Component({
  selector: 'z-sheet-panel',
  imports: [VmIconButton, NgIcon, TranslocoPipe],
  template: `
    @if (zClosable()) {
      <button
        type="button"
        data-testid="z-close-header-button"
        data-slot="sheet-close"
        vm-icon-button
        class="absolute end-2 top-2"
        (click)="closeRequested.emit()"
      >
        <ng-icon name="lucideX" class="size-4!" />
        <span class="sr-only">{{ 'common.close' | transloco }}</span>
      </button>
    }
    <ng-content />
  `,
  styles: `
    z-sheet-panel {
      --z-sheet-duration: 200ms;
      opacity: 1;
      translate: 0 0;
      transition:
        opacity var(--z-sheet-duration) ease-in-out,
        translate var(--z-sheet-duration) ease-in-out;
    }

    @starting-style {
      z-sheet-panel[data-side='right'] {
        opacity: 0;
        translate: 2.5rem 0;
      }
      z-sheet-panel[data-side='left'] {
        opacity: 0;
        translate: -2.5rem 0;
      }
      z-sheet-panel[data-side='top'] {
        opacity: 0;
        translate: 0 -2.5rem;
      }
      z-sheet-panel[data-side='bottom'] {
        opacity: 0;
        translate: 0 2.5rem;
      }
    }

    z-sheet-panel[data-state='closed'][data-side='right'] {
      opacity: 0;
      translate: 2.5rem 0;
    }
    z-sheet-panel[data-state='closed'][data-side='left'] {
      opacity: 0;
      translate: -2.5rem 0;
    }
    z-sheet-panel[data-state='closed'][data-side='top'] {
      opacity: 0;
      translate: 0 -2.5rem;
    }
    z-sheet-panel[data-state='closed'][data-side='bottom'] {
      opacity: 0;
      translate: 0 2.5rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  viewProviders: [provideIcons({ lucideX })],
  host: {
    'data-slot': 'sheet-content',
    role: 'dialog',
    'aria-modal': 'true',
    tabindex: '-1',
    '[attr.data-side]': 'zSide()',
    '[attr.data-state]': 'zState()',
    '[attr.aria-labelledby]': 'zLabelledBy()',
    '[attr.aria-describedby]': 'zDescribedBy()',
    '[class]': 'classes()',
    '[style.width]': 'zWidth() || null',
    '[style.height]': 'zHeight() || null',
    '[style.--z-sheet-duration.ms]': 'zDuration()',
  },
  exportAs: 'zSheetPanel',
})
export class ZardSheetPanelComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly focusTrapFactory = inject(FocusTrapFactory);
  private readonly destroyRef = inject(DestroyRef);

  readonly zSide = input<ZardSheetSide>('right');
  readonly zSize = input<ZardSheetSize>('default');
  readonly zWidth = input<string | undefined>(undefined);
  readonly zHeight = input<string | undefined>(undefined);
  readonly zClosable = input(true, { transform: booleanAttribute });
  readonly zDuration = input(SHEET_DURATION);
  readonly zState = input<'open' | 'closed'>('open');
  readonly zLabelledBy = input<string | null>(null);
  readonly zDescribedBy = input<string | null>(null);
  readonly class = input<ClassValue>('');

  readonly closeRequested = output<void>();

  protected readonly classes = computed(() => {
    const zSize = this.zWidth() || this.zHeight() ? 'custom' : this.zSize();
    return mergeClasses(sheetVariants({ zSide: this.zSide(), zSize }), this.class());
  });

  constructor() {
    afterNextRender(() => {
      const trap = this.focusTrapFactory.create(this.host.nativeElement);
      void trap.focusInitialElementWhenReady();
      this.destroyRef.onDestroy(() => trap.destroy());
    });
  }
}
