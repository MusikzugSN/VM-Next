import type { OverlayRef } from '@angular/cdk/overlay';

import { ZardOverlayRefBase } from '@vm-web/ui/zard/core';

import type { ZardDialogContainerComponent, ZardDialogOptions } from './dialog-container.component';
import { DIALOG_DURATION } from './dialog-panel.component';

export class ZardDialogRef<T = unknown, R = unknown, U = unknown> extends ZardOverlayRefBase<T, R> {
  constructor(
    overlayRef: OverlayRef | null,
    private readonly config: ZardDialogOptions<T, U>,
    private readonly containerInstance: ZardDialogContainerComponent<T, U> | null,
    platformId: object,
  ) {
    super(overlayRef, config, platformId);
    this.attach(this.containerInstance ? ZardDialogRef.outputsOf(this.containerInstance) : null);
  }

  protected override get defaultDuration(): number {
    return DIALOG_DURATION;
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
