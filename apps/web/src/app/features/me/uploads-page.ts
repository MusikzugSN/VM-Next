import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideUpload } from '@ng-icons/lucide';
import { apiUrl, myUploadsResponseSchema, type MyUploadItem, type UploadStatus } from '@vm-web/shared';

import { VmButton, VmCard, VmTable } from '@vm-web/ui';

import { UploadLauncher } from '../../core/actions/pending-features';
import { onUploadCompleted } from '../../core/actions/on-upload';
import { ApiClient } from '../../core/api/api-client';
import { cursorList } from '../../core/api/cursor-list';
import { SessionStore } from '../../core/auth/session.store';
import { ViewportService } from '../../core/layout/viewport';
import { ListState } from '../../shared/ui/list-state';
import { UploadStatusBadge } from './ui/upload-status-badge';

/** Meine Uploads (N-14): status of each own upload incl. the reason for a rejection. */
@Component({
  selector: 'vm-me-uploads-page',
  imports: [VmTable, VmCard, DatePipe, NgIcon, TranslocoPipe, VmButton, ListState, UploadStatusBadge],
  viewProviders: [provideIcons({ lucideUpload })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './uploads-page.html',
})
export class UploadsPage {
  private readonly api = inject(ApiClient);
  private readonly session = inject(SessionStore);
  private readonly uploads = inject(UploadLauncher);
  protected readonly viewport = inject(ViewportService);

  protected readonly filters: { value: UploadStatus | null; labelKey: string }[] = [
    { value: null, labelKey: 'me.uploads.all' },
    { value: 'pending', labelKey: 'status.pending' },
    { value: 'approved', labelKey: 'status.approved' },
    { value: 'rejected', labelKey: 'status.rejected' },
  ];
  protected readonly status = signal<UploadStatus | null>(null);
  protected readonly canUpload = computed(() => this.session.can('sheet.upload'));

  protected readonly list = cursorList({
    params: () => this.status(),
    fetch: (status, cursor) => this.api.get(apiUrl('me', 'myUploads'), myUploadsResponseSchema, { cursor, status }),
  });

  constructor() {
    onUploadCompleted(() => this.list.reload());
  }

  protected title(entry: MyUploadItem): string {
    const score = entry.score?.name ?? entry.fileName;
    return entry.voice ? `${score} – ${entry.voice.name}` : score;
  }

  protected upload(): void {
    this.uploads.open();
  }
}
