import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { PluralPipe } from '../../core/i18n/plural.pipe';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronRight, lucideFileArchive } from '@ng-icons/lucide';
import { APP_ROUTES, apiUrl, appPath, myFoldersResponseSchema, type MyFolderItem } from '@vm-web/shared';

import { VmCard, VmIconButton, VmTable } from '@vm-web/ui';

import { ApiClient } from '../../core/api/api-client';
import { cursorList } from '../../core/api/cursor-list';
import { folderZipUrl } from '../../core/api/urls';
import { ViewportService } from '../../core/layout/viewport';
import { VoiceContextStore } from '../../core/voices/voice-context.store';
import { ListState } from '../../shared/ui/list-state';

/** Mappen (R-2, M-4): folders released for Mein Bereich in the own ensembles. */
@Component({
  selector: 'vm-me-folders-page',
  imports: [VmTable, VmCard, PluralPipe, RouterLink, NgIcon, TranslocoPipe, VmIconButton, ListState],
  viewProviders: [provideIcons({ lucideChevronRight, lucideFileArchive })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './folders-page.html',
})
export class FoldersPage {
  private readonly api = inject(ApiClient);
  private readonly voices = inject(VoiceContextStore);
  protected readonly viewport = inject(ViewportService);

  protected readonly voiceNames = computed(() =>
    this.voices
      .activeVoices()
      .map((voice) => voice.name)
      .join(', '),
  );

  protected readonly list = cursorList({
    params: () => null,
    fetch: (_params, cursor) => this.api.get(apiUrl('me', 'folders'), myFoldersResponseSchema, { cursor }),
  });

  protected link(folder: MyFolderItem): string {
    return appPath(APP_ROUTES.me.folder, { folderId: folder.id });
  }

  protected zip(folder: MyFolderItem): string {
    return folderZipUrl(folder.id, this.voices.overrideIds());
  }
}
