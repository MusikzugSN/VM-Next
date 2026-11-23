import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { PluralPipe } from '../../core/i18n/plural.pipe';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronRight, lucideFolderOpen, lucideUpload } from '@ng-icons/lucide';
import {
  APP_ROUTES,
  apiUrl,
  appPath,
  myFoldersResponseSchema,
  myUploadsResponseSchema,
  upcomingEventsResponseSchema,
} from '@vm-web/shared';

import { VmButton } from '@vm-web/ui';

import { onUploadCompleted } from '../../core/actions/on-upload';
import { UploadLauncher } from '../../core/actions/pending-features';
import { ApiClient } from '../../core/api/api-client';
import { SessionStore } from '../../core/auth/session.store';
import { VoiceContextStore } from '../../core/voices/voice-context.store';
import { EventDate } from './ui/event-date';
import { UploadStatusBadge } from './ui/upload-status-badge';
import { VoiceSelectionDialog } from './ui/voice-selection-dialog';

const POSTPONED_KEY = 'vmweb.voiceSelectionPostponed';

/** Start of Mein Bereich (M-1, M-2, M-5, N-14): upcoming events, folders, own uploads. */
@Component({
  selector: 'vm-me-start-page',
  imports: [PluralPipe, 
    DatePipe,
    RouterLink,
    NgIcon,
    TranslocoPipe,
    VmButton,
    EventDate,
    UploadStatusBadge,
    VoiceSelectionDialog,
  ],
  viewProviders: [provideIcons({ lucideUpload, lucideFolderOpen, lucideChevronRight })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './start-page.html',
})
export class StartPage {
  private readonly api = inject(ApiClient);
  private readonly session = inject(SessionStore);
  private readonly uploads = inject(UploadLauncher);
  protected readonly voices = inject(VoiceContextStore);

  protected readonly routes = APP_ROUTES.me;
  protected readonly firstName = computed(() => (this.session.user()?.name ?? '').split(' ')[0]);
  protected readonly voiceNames = computed(() =>
    this.voices
      .activeVoices()
      .map((voice) => voice.name)
      .join(', '),
  );
  protected readonly canUpload = computed(() => this.session.can('sheet.upload'));
  protected readonly selectVoices = signal(false);

  protected readonly events = rxResource({
    stream: () => this.api.get(apiUrl('me', 'upcomingEvents'), upcomingEventsResponseSchema, { limit: 3 }),
  });
  protected readonly folders = rxResource({
    stream: () => this.api.get(apiUrl('me', 'folders'), myFoldersResponseSchema, { limit: 5 }),
  });
  protected readonly myUploads = rxResource({
    stream: () => this.api.get(apiUrl('me', 'myUploads'), myUploadsResponseSchema, { limit: 3 }),
  });

  constructor() {
    onUploadCompleted(() => this.myUploads.reload());
    // M-1: on the first visit without profile voices, ask for them (unless postponed in this tab).
    effect(() => {
      if (this.voices.needsVoiceSelection() && !postponed()) this.selectVoices.set(true);
    });
  }

  protected eventLink(id: string): string {
    return appPath(APP_ROUTES.me.event, { eventId: id });
  }

  protected folderLink(id: string): string {
    return appPath(APP_ROUTES.me.folder, { folderId: id });
  }

  protected upload(): void {
    this.uploads.open();
  }

  protected postpone(): void {
    try {
      sessionStorage.setItem(POSTPONED_KEY, '1');
    } catch {
      // Storage blocked: the dialog may open again after a reload.
    }
  }
}

function postponed(): boolean {
  try {
    return sessionStorage.getItem(POSTPONED_KEY) === '1';
  } catch {
    return false;
  }
}
