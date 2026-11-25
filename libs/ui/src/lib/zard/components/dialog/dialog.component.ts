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

import { nextDialogId, ZardDialogHost } from './dialog-host';
import { DIALOG_DURATION, ZardDialogPanelComponent } from './dialog-panel.component';
import {
  DIALOG_BACKDROP_CLASSES,
  dialogDescriptionVariants,
  dialogFooterVariants,
  dialogHeaderVariants,
  dialogTitleVariants,
} from './dialog.variants';

const ESCAPE_KEYS = ['Escape', 'Esc'];

@Component({
  selector: 'z-dialog',
  imports: [ZardDialogPanelComponent],
  template: `
    <ng-template #panel>
      <z-dialog-panel
        [zClosable]="zClosable()"
        [zWidth]="zWidth()"
        [zDuration]="zDuration()"
        [zState]="state()"
        [zLabelledBy]="titleId()"
        [zDescribedBy]="descriptionId()"
        [class]="class()"
        (closeRequested)="requestClose()"
      >
        <ng-content />
      </z-dialog-panel>
    </ng-template>
  `,
  providers: [{ provide: ZardDialogHost, useExisting: forwardRef(() => ZardDialogComponent) }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: { style: 'display: contents' },
  exportAs: 'zDialog',
})
export class ZardDialogComponent extends ZardDialogHost {
  private readonly overlay = inject(Overlay);
  private readonly directionality = inject(Directionality, { optional: true });
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  private readonly panel = viewChild.required<TemplateRef<void>>('panel');

  readonly zVisible = model(false);
  readonly zClosable = input(true, { transform: booleanAttribute });
  readonly zMaskClosable = input(true, { transform: booleanAttribute });
  readonly zWidth = input<string | undefined>(undefined);
  readonly zDuration = input(DIALOG_DURATION);
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
        backdropClass: DIALOG_BACKDROP_CLASSES,
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
  selector: 'z-dialog-header, [z-dialog-header]',
  template: `
    <ng-content />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    'data-slot': 'dialog-header',
    '[class]': 'classes()',
  },
  exportAs: 'zDialogHeader',
})
export class ZardDialogHeaderComponent {
  readonly class = input<ClassValue>('');

  protected readonly classes = computed(() => mergeClasses(dialogHeaderVariants(), this.class()));
}

@Component({
  selector: 'z-dialog-title, [z-dialog-title]',
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
    'data-slot': 'dialog-title',
    role: 'heading',
    'aria-level': '2',
    '[attr.id]': 'id',
    '[class]': 'classes()',
  },
  exportAs: 'zDialogTitle',
})
export class ZardDialogTitleComponent {
  private readonly dialog = inject(ZardDialogHost, { optional: true });

  readonly class = input<ClassValue>('');
  readonly zTitle = input<string | TemplateRef<void>>();

  protected readonly id = nextDialogId('title');
  protected readonly classes = computed(() => mergeClasses(dialogTitleVariants(), this.class()));

  constructor() {
    afterNextRender(() => this.dialog?.titleId.set(this.id));

    inject(DestroyRef).onDestroy(() => {
      if (this.dialog?.titleId() === this.id) {
        this.dialog.titleId.set(null);
      }
    });
  }
}

@Component({
  selector: 'z-dialog-description, [z-dialog-description]',
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
    'data-slot': 'dialog-description',
    '[attr.id]': 'id',
    '[class]': 'classes()',
  },
  exportAs: 'zDialogDescription',
})
export class ZardDialogDescriptionComponent {
  private readonly dialog = inject(ZardDialogHost, { optional: true });

  readonly class = input<ClassValue>('');
  readonly zDescription = input<string | TemplateRef<void>>();

  protected readonly id = nextDialogId('description');
  protected readonly classes = computed(() => mergeClasses(dialogDescriptionVariants(), this.class()));

  constructor() {
    afterNextRender(() => this.dialog?.descriptionId.set(this.id));

    inject(DestroyRef).onDestroy(() => {
      if (this.dialog?.descriptionId() === this.id) {
        this.dialog.descriptionId.set(null);
      }
    });
  }
}

@Component({
  selector: 'z-dialog-footer, [z-dialog-footer]',
  template: `
    <ng-content />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    'data-slot': 'dialog-footer',
    '[class]': 'classes()',
  },
  exportAs: 'zDialogFooter',
})
export class ZardDialogFooterComponent {
  readonly class = input<ClassValue>('');

  protected readonly classes = computed(() => mergeClasses(dialogFooterVariants(), this.class()));
}

@Directive({
  selector: '[z-dialog-close]',
  host: {
    'data-slot': 'dialog-close',
    '(click)': 'onClick()',
  },
  exportAs: 'zDialogClose',
})
export class ZardDialogCloseDirective {
  private readonly dialog = inject(ZardDialogHost, { optional: true });

  protected onClick(): void {
    this.dialog?.requestClose();
  }
}
