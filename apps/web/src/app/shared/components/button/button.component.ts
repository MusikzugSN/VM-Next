import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  type OnDestroy,
  ElementRef,
  inject,
  input,
  signal,
  ViewEncapsulation,
  booleanAttribute,
} from '@angular/core';

import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideLoaderCircle } from '@ng-icons/lucide';
import type { ClassValue } from 'clsx';

import { mergeClasses } from '@/shared/utils/merge-classes';

import {
  buttonVariants,
  type ZardButtonShapeVariants,
  type ZardButtonSizeVariants,
  type ZardButtonTypeVariants,
} from './button.variants';

@Component({
  selector: 'z-button, button[z-button], a[z-button]',
  imports: [NgIcon],
  template: `
    @if (zLoading()) {
      <ng-icon name="lucideLoaderCircle" class="animate-spin duration-2000" />
    }
    <ng-content />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  viewProviders: [provideIcons({ lucideLoaderCircle })],
  host: {
    'data-slot': 'button',
    '[class]': 'classes()',
    // VM-Web: disabled is driven only by zDisabled (also for native <button>), because this host binding
    // would otherwise remove a [disabled] set in the template. Use [zDisabled] on z-button, never [disabled].
    '[attr.data-disabled]': 'zDisabled() || null',
    '[attr.data-icon-only]': 'iconOnly() || null',
    '[attr.data-size]': 'zSize()',
    '[attr.data-variant]': 'zType()',
    '[attr.aria-disabled]': 'zDisabled() || null',
    '[attr.disabled]': 'zDisabled() && !isLinkHost() ? "" : null',
    '[attr.role]': 'isNotInsideOfButtonOrLink() ? "button" : null',
    '[attr.tabindex]': 'isNotInsideOfButtonOrLink() ? "0" : null',
  },
  exportAs: 'zButton',
})
export class ZardButtonComponent implements OnDestroy {
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  readonly zType = input<ZardButtonTypeVariants>('default');
  readonly zSize = input<ZardButtonSizeVariants>('default');
  readonly zShape = input<ZardButtonShapeVariants>('default');
  readonly class = input<ClassValue>('');
  readonly zLoading = input(false, { transform: booleanAttribute });
  readonly zDisabled = input(false, { transform: booleanAttribute });

  private readonly iconOnlyState = signal(false);
  readonly iconOnly = this.iconOnlyState.asReadonly();

  private _mutationObserver: MutationObserver | null = null;

  constructor() {
    afterNextRender(() => {
      if (typeof window === 'undefined' || typeof MutationObserver === 'undefined') {
        return;
      }

      const check = () => {
        const el = this.elementRef.nativeElement;
        const hasIcon = el.querySelector('ng-icon') !== null;
        const children = Array.from<Node>(el.childNodes);
        const hasText = children.some(node => {
          if (node.nodeType === 3) {
            return node.textContent?.trim() !== '';
          }
          if (node.nodeType === 1) {
            const element = node as HTMLElement;
            if (element.matches('ng-icon')) {
              return false;
            }
            return element.textContent?.trim() !== '';
          }
          return false;
        });

        this.iconOnlyState.set(hasIcon && !hasText);
      };

      check();
      this._mutationObserver = new MutationObserver(check);
      this._mutationObserver.observe(this.elementRef.nativeElement, {
        childList: true,
        characterData: true,
        subtree: true,
      });
    });
  }

  ngOnDestroy(): void {
    if (this._mutationObserver) {
      this._mutationObserver.disconnect();
      this._mutationObserver = null;
    }
  }

  protected readonly classes = computed(() =>
    mergeClasses(
      buttonVariants({
        zType: this.zType(),
        zSize: this.zSize(),
        zShape: this.zShape(),
        zLoading: this.zLoading(),
        zDisabled: this.zDisabled(),
      }),
      this.class(),
    ),
  );

  /** VM-Web: links have no disabled attribute; aria-disabled and pointer-events cover them. */
  protected readonly isLinkHost = computed(() => this.elementRef.nativeElement.tagName === 'A');

  protected readonly isNotInsideOfButtonOrLink = computed(() => {
    // Evaluated once; assumes component parent doesn't change after mount
    const zardButtonElement = this.elementRef.nativeElement;
    // VM-Web: a native <button> or <a> host keeps its own role (links must stay links for screen readers).
    if (zardButtonElement.tagName === 'BUTTON' || zardButtonElement.tagName === 'A') return false;
    if (zardButtonElement.parentElement) {
      const { tagName } = zardButtonElement.parentElement;
      return tagName !== 'BUTTON' && tagName !== 'A';
    }
    return true;
  });
}
