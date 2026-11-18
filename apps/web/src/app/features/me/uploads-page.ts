import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideUpload } from '@ng-icons/lucide';
import { apiUrl, myUploadsResponseSchema, type MyUploadItem, type UploadStatus } from '@vm-web/shared';

import { ZardButtonComponent } from '@/shared/components/button';

import { UploadLauncher } from '../../core/actions/pending-features';
import { ApiClient } from '../../core/api/api-client';
import { cursorList } from '../../core/api/cursor-list';
import { SessionStore } from '../../core/auth/session.store';
import { ViewportService } from '../../core/layout/viewport';
import { ListState } from './ui/list-state';
import { UploadStatusBadge } from './ui/upload-status-badge';

/** Meine Uploads (N-14): status of each own upload incl. the reason for a rejection. */
@Component({
  selector: 'vm-me-uploads-page',
  imports: [DatePipe, NgIcon, TranslocoPipe, ZardButtonComponent, ListState, UploadStatusBadge],
  viewProviders: [provideIcons({ lucideUpload })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div>
        <h1 class="text-2xl font-semibold">{{ 'nav.me.uploads' | transloco }}</h1>
        <p class="mt-1 text-muted-foreground">{{ 'me.uploads.intro' | transloco }}</p>
      </div>
      @if (canUpload()) {
        <button z-button type="button" class="w-full md:w-auto" (click)="upload()">
          <ng-icon name="lucideUpload" aria-hidden="true" />{{ 'me.start.uploadVoice' | transloco }}
        </button>
      }
    </div>

    <div role="group" [attr.aria-label]="'me.uploads.statusFilter' | transloco" class="flex flex-wrap gap-2">
      @for (option of filters; track option.labelKey) {
        <button
          type="button"
          [attr.aria-pressed]="status() === option.value"
          (click)="status.set(option.value)"
          class="inline-flex min-h-11 items-center rounded-md border px-3 font-medium xl:min-h-9"
          [class]="status() === option.value ? 'border-primary bg-primary-soft text-primary' : 'border-input'"
        >
          {{ option.labelKey | transloco }}
        </button>
      }
    </div>

    @if (viewport.isMobile()) {
      <ul class="flex flex-col gap-2">
        @for (upload of list.items(); track upload.id) {
          <li class="flex flex-col gap-1.5 rounded-lg border bg-card p-4 shadow-sm">
            <span class="text-base font-medium">{{ title(upload) }}</span>
            <span class="flex items-center gap-2">
              <vm-upload-status-badge [status]="upload.status" />
              <span class="text-muted-foreground">{{ upload.uploadedAt | date: 'dd.MM.yyyy' }}</span>
            </span>
            @if (upload.rejectionReason) {
              <span class="text-destructive-ink">{{ 'me.uploads.reason' | transloco: { reason: upload.rejectionReason } }}</span>
            }
          </li>
        }
      </ul>
    } @else if (list.items().length > 0) {
      <div class="overflow-x-auto rounded-lg border bg-card shadow-sm">
        <table class="w-full">
          <thead class="bg-muted text-xs font-medium text-muted-foreground">
            <tr>
              <th scope="col" class="w-28 px-3 py-2 text-start">{{ 'me.uploads.date' | transloco }}</th>
              <th scope="col" class="px-3 py-2 text-start">{{ 'terms.score' | transloco }}</th>
              <th scope="col" class="px-3 py-2 text-start">{{ 'terms.voice' | transloco }}</th>
              <th scope="col" class="px-3 py-2 text-start">{{ 'terms.sheet' | transloco }}</th>
              <th scope="col" class="px-3 py-2 text-start">{{ 'me.uploads.status' | transloco }}</th>
            </tr>
          </thead>
          <tbody>
            @for (upload of list.items(); track upload.id) {
              <tr class="border-t align-top">
                <td class="px-3 py-2 tabular-nums">{{ upload.uploadedAt | date: 'dd.MM.yyyy' }}</td>
                <td class="px-3 py-2">{{ upload.score?.name ?? '–' }}</td>
                <td class="px-3 py-2">{{ upload.voice?.name ?? '–' }}</td>
                <td class="px-3 py-2 font-mono text-[13px] text-muted-foreground">{{ upload.fileName }}</td>
                <td class="px-3 py-2">
                  <div class="flex flex-col items-start gap-1">
                    <vm-upload-status-badge [status]="upload.status" />
                    @if (upload.rejectionReason) {
                      <span class="text-destructive-ink">{{ 'me.uploads.reason' | transloco: { reason: upload.rejectionReason } }}</span>
                    }
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
    <vm-list-state [list]="list" emptyKey="me.uploads.empty" />
  `,
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

  protected title(upload: MyUploadItem): string {
    const score = upload.score?.name ?? upload.fileName;
    return upload.voice ? `${score} – ${upload.voice.name}` : score;
  }

  protected upload(): void {
    this.uploads.open();
  }
}
