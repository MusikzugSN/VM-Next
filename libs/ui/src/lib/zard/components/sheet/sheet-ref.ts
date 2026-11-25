import type { OverlayRef } from '@angular/cdk/overlay';

import { ZardOverlayRefBase } from '@vm-web/ui/zard/core';

import type { ZardSheetContainerComponent, ZardSheetOptions } from './sheet-container.component';
import { SHEET_DURATION } from './sheet-panel.component';

export class ZardSheetRef<T = unknown, R = unknown, U = unknown> extends ZardOverlayRefBase<T, R> {
  constructor(
    overlayRef: OverlayRef | null,
    private readonly config: ZardSheetOptions<T, U>,
    private readonly containerInstance: ZardSheetContainerComponent<T, U> | null,
    platformId: object,
  ) {
    super(overlayRef, config, platformId);
    this.attach(this.containerInstance ? ZardSheetRef.outputsOf(this.containerInstance) : null);
  }

  protected override get defaultDuration(): number {
    return SHEET_DURATION;
  }

  protected override playLeaveAnimation(): void {
    this.containerInstance?.leave();
    this.overlayRef?.detachBackdrop();
  }

  protected override closesOnOutsidePointer(): boolean {
    return this.config.zMaskClosable ?? true;
  }

  protected override closesOnEscape(): boolean {
    return this.config.zClosable ?? true;
  }
}
