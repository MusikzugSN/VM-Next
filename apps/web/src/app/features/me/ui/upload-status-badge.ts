import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { UploadStatus } from '@vm-web/shared';

import { StatusBadge } from '../../../shared/ui/status-badge';

/** Upload status (N-14): Ungeprüft · Freigegeben · Abgelehnt. */
@Component({
  selector: 'vm-upload-status-badge',
  imports: [StatusBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex' },
  template: `<vm-status-badge [kind]="status()" />`,
})
export class UploadStatusBadge {
  readonly status = input.required<UploadStatus>();
}
