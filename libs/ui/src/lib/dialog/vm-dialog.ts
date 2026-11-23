import { ChangeDetectionStrategy, Component, forwardRef, ViewEncapsulation } from '@angular/core';

import { ZardAlertDialogService } from '../zard/components/alert-dialog';
import { ZardDialogHost } from '../zard/components/dialog/dialog-host';
import { ZardDialogPanelComponent } from '../zard/components/dialog/dialog-panel.component';
import {
  ZardDialogComponent,
  ZardDialogDescriptionComponent,
  ZardDialogFooterComponent,
  ZardDialogHeaderComponent,
  ZardDialogTitleComponent,
} from '../zard/components/dialog/dialog.component';
import { ZardSheetHost } from '../zard/components/sheet/sheet-host';
import { ZardSheetPanelComponent } from '../zard/components/sheet/sheet-panel.component';
import { ZardSheetComponent, ZardSheetHeaderComponent, ZardSheetTitleComponent } from '../zard/components/sheet/sheet.component';

const PROJECT = '<ng-content />';

/** M3 Basic Dialog, auf Telefonen Vollbild. Öffnen, Schließen und Fokus kommen aus Zard. */
@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'vm-dialog',
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
  providers: [{ provide: ZardDialogHost, useExisting: forwardRef(() => VmDialog) }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: { style: 'display: contents' },
  exportAs: 'vmDialog',
})
export class VmDialog extends ZardDialogComponent {}

@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'vm-dialog-header',
  template: PROJECT,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class VmDialogHeader extends ZardDialogHeaderComponent {}

@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: '[vm-dialog-title]',
  template: PROJECT,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class VmDialogTitle extends ZardDialogTitleComponent {}

@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: '[vm-dialog-description]',
  template: PROJECT,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class VmDialogDescription extends ZardDialogDescriptionComponent {}

@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'vm-dialog-footer',
  template: PROJECT,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class VmDialogFooter extends ZardDialogFooterComponent {}

export const VmDialogImports = [VmDialog, VmDialogHeader, VmDialogTitle, VmDialogDescription, VmDialogFooter] as const;

/** M3 Side Sheet für die Navigation auf kleinen Bildschirmen. */
@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'vm-sheet',
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
  providers: [{ provide: ZardSheetHost, useExisting: forwardRef(() => VmSheet) }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: { style: 'display: contents' },
  exportAs: 'vmSheet',
})
export class VmSheet extends ZardSheetComponent {}

@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'vm-sheet-header',
  template: PROJECT,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class VmSheetHeader extends ZardSheetHeaderComponent {}

@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: '[vm-sheet-title]',
  template: PROJECT,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class VmSheetTitle extends ZardSheetTitleComponent {}

export const VmSheetImports = [VmSheet, VmSheetHeader, VmSheetTitle] as const;

/** Öffnet Bestätigungsdialoge (M3 Basic Dialog) aus dem Code. */
export { ZardAlertDialogService as VmConfirmDialogService };
