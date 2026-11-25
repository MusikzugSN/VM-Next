import { Directionality } from '@angular/cdk/bidi';
import { Overlay, OverlayConfig, type OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  Directive,
  effect,
  forwardRef,
  inject,
  input,
  model,
  output,
  PLATFORM_ID,
  signal,
  type TemplateRef,
  untracked,
  ViewContainerRef,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';

import type { ClassValue } from 'clsx';
import { filter, takeUntil } from 'rxjs';

import { isTopmostOverlay, popOverlay, pushOverlay, ZardStringTemplateOutletDirective } from '@vm-web/ui/zard/core';
import { mergeClasses } from '@vm-web/ui/zard/utils/merge-classes';

import { nextSheetId, ZardSheetHost } from './sheet-host';
import {
  SHEET_DURATION,
  ZardSheetPanelComponent,
  type ZardSheetSide,
  type ZardSheetSize,
} from './sheet-panel.component';
import {
  SHEET_BACKDROP_CLASSES,
  sheetDescriptionVariants,
  sheetFooterVariants,
  sheetHeaderVariants,
  sheetTitleVariants,
} from './sheet.variants';

const ESCAPE_KEYS = ['Escape', 'Esc'];

@Component({
  selector: 'z-sheet',
  imports: [ZardSheetPanelComponent],
  template: `
    <ng-template #panel>
      <z-sheet-panel
        [zSide]="zSide()"
        [zSize]="zSize()"
        [zWidth]="zWidth()"
        [zHeight]="zHeight()"
        [zClosable]="zClosable()"
        [zDuration]="zDuration()"
        [zState]="state()"
        [zLabelledBy]="titleId()"
        [zDescribedBy]="descriptionId()"
        [class]="class()"
        (closeRequested)="requestClose()"
      >
        <ng-content />
      </z-sheet-panel>
    </ng-template>
  `,
  providers: [{ provide: ZardSheetHost, useExisting: forwardRef(() => ZardSheetComponent) }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: { style: 'display: contents' },
  exportAs: 'zSheet',
})
export class ZardSheetComponent extends ZardSheetHost {
  private readonly overlay = inject(Overlay);
  private readonly directionality = inject(Directionality, { optional: true });
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  private readonly panel = viewChild.required<TemplateRef<void>>('panel');

  readonly zVisible = model(false);
  readonly zSide = input<ZardSheetSide>('right');
  readonly zSize = input<ZardSheetSize>('default');
  readonly zWidth = input<string | undefined>(undefined);
  readonly zHeight = input<string | undefined>(undefined);
  readonly zClosable = input(true, { transform: booleanAttribute });
  readonly zMaskClosable = input(true, { transform: booleanAttribute });
  readonly zDuration = input(SHEET_DURATION);
  readonly class = input<ClassValue>('');

  readonly zAfterOpen = output<void>();
  readonly zAfterClose = output<void>();

  readonly titleId = signal<string | null>(null);
  readonly descriptionId = signal<string | null>(null);

  protected readonly state = signal<'open' | 'closed'>('open');

  private overlayRef: OverlayRef | null = null;
  private disposeTimer: ReturnType<typeof setTimeout> | null = null;
  private previouslyFocused: HTMLElement | null = null;
  private destroyed = false;

  constructor() {
    super();

    effect(() => {
      const visible = this.zVisible();
      untracked(() => (visible ? this.open() : this.startClose()));
    });

    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      this.dispose();
    });
  }

  requestClose(): void {
    this.zVisible.set(false);
  }

  private open(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    if (this.overlayRef) {
      this.clearDisposeTimer();
      this.state.set('open');
      return;
    }

    this.previouslyFocused = document.activeElement as HTMLElement | null;
    this.state.set('open');

    const overlayRef = this.overlay.create(
      new OverlayConfig({
        direction: this.directionality?.value ?? 'ltr',
        hasBackdrop: true,
        backdropClass: SHEET_BACKDROP_CLASSES,
        positionStrategy: this.overlay.position().global(),
        scrollStrategy: this.overlay.scrollStrategies.block(),
        disposeOnNavigation: true,
      }),
    );
    this.overlayRef = overlayRef;

    this.directionality?.change
      .pipe(takeUntil(overlayRef.detachments()))
      .subscribe(() => overlayRef.setDirection(this.directionality?.value ?? 'ltr'));

    overlayRef.attach(new TemplatePortal(this.panel(), this.viewContainerRef));
    pushOverlay(this);

    overlayRef.backdropClick().subscribe(() => {
      if (this.zMaskClosable()) {
        this.requestClose();
      }
    });
    overlayRef
      .keydownEvents()
      .pipe(filter(event => ESCAPE_KEYS.includes(event.key)))
      .subscribe(event => {
        if (!isTopmostOverlay(this) || !this.zClosable()) return;
        event.preventDefault();
        this.requestClose();
      });

    this.zAfterOpen.emit();
  }

  private startClose(): void {
    if (!this.overlayRef || this.disposeTimer !== null) {
      return;
    }

    this.state.set('closed');
    this.overlayRef.detachBackdrop();
    this.disposeTimer = setTimeout(() => this.dispose(), this.zDuration());
  }

  private dispose(): void {
    this.clearDisposeTimer();
    if (!this.overlayRef) {
      return;
    }

    popOverlay(this);
    this.overlayRef.dispose();
    this.overlayRef = null;

    if (this.previouslyFocused?.isConnected) {
      this.previouslyFocused.focus();
    }
    this.previouslyFocused = null;

    if (!this.destroyed) {
      this.zAfterClose.emit();
    }
  }

  private clearDisposeTimer(): void {
    if (this.disposeTimer === null) {
      return;
    }

    clearTimeout(this.disposeTimer);
    this.disposeTimer = null;
  }
}

@Component({
  selector: 'z-sheet-header, [z-sheet-header]',
  template: `
    <ng-content />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    'data-slot': 'sheet-header',
    '[class]': 'classes()',
  },
  exportAs: 'zSheetHeader',
})
export class ZardSheetHeaderComponent {
  readonly class = input<ClassValue>('');

  protected readonly classes = computed(() => mergeClasses(sheetHeaderVariants(), this.class()));
}

@Component({
  selector: 'z-sheet-title, [z-sheet-title]',
  imports: [ZardStringTemplateOutletDirective],
  template: `
    @let title = zTitle();
    <ng-container *zStringTemplateOutlet="title">
      {{ title }}
      <ng-content />
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    'data-slot': 'sheet-title',
    role: 'heading',
    'aria-level': '2',
    '[attr.id]': 'id',
    '[class]': 'classes()',
  },
  exportAs: 'zSheetTitle',
})
export class ZardSheetTitleComponent {
  private readonly sheet = inject(ZardSheetHost, { optional: true });

  readonly class = input<ClassValue>('');
  readonly zTitle = input<string | TemplateRef<void>>();

  protected readonly id = nextSheetId('title');
  protected readonly classes = computed(() => mergeClasses(sheetTitleVariants(), this.class()));

  constructor() {
    afterNextRender(() => this.sheet?.titleId.set(this.id));

    inject(DestroyRef).onDestroy(() => {
      if (this.sheet?.titleId() === this.id) {
        this.sheet.titleId.set(null);
      }
    });
  }
}

@Component({
  selector: 'z-sheet-description, [z-sheet-description]',
  imports: [ZardStringTemplateOutletDirective],
  template: `
    @let description = zDescription();
    <ng-container *zStringTemplateOutlet="description">
      {{ description }}
      <ng-content />
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    'data-slot': 'sheet-description',
    '[attr.id]': 'id',
    '[class]': 'classes()',
  },
  exportAs: 'zSheetDescription',
})
export class ZardSheetDescriptionComponent {
  private readonly sheet = inject(ZardSheetHost, { optional: true });

  readonly class = input<ClassValue>('');
  readonly zDescription = input<string | TemplateRef<void>>();

  protected readonly id = nextSheetId('description');
  protected readonly classes = computed(() => mergeClasses(sheetDescriptionVariants(), this.class()));

  constructor() {
    afterNextRender(() => this.sheet?.descriptionId.set(this.id));

    inject(DestroyRef).onDestroy(() => {
      if (this.sheet?.descriptionId() === this.id) {
        this.sheet.descriptionId.set(null);
      }
    });
  }
}

@Component({
  selector: 'z-sheet-footer, [z-sheet-footer]',
  template: `
    <ng-content />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    'data-slot': 'sheet-footer',
    '[class]': 'classes()',
  },
  exportAs: 'zSheetFooter',
})
export class ZardSheetFooterComponent {
  readonly class = input<ClassValue>('');

  protected readonly classes = computed(() => mergeClasses(sheetFooterVariants(), this.class()));
}

@Directive({
  selector: '[z-sheet-close]',
  host: {
    'data-slot': 'sheet-close',
    '(click)': 'onClick()',
  },
  exportAs: 'zSheetClose',
})
export class ZardSheetCloseDirective {
  private readonly sheet = inject(ZardSheetHost, { optional: true });

  protected onClick(): void {
    this.sheet?.requestClose();
  }
}
