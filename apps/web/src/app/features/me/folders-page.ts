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
  template: `
    <div>
      <h1 class="text-2xl font-semibold">{{ 'nav.me.folders' | transloco }}</h1>
      @if (voiceNames()) {
        <p class="mt-2 text-muted-foreground">{{ 'me.folders.intro' | transloco: { voices: voiceNames() } }}</p>
      }
    </div>

    @if (viewport.isMobile()) {
      <ul class="flex flex-col gap-2">
        @for (folder of list.items(); track folder.id) {
          <li>
            <a [routerLink]="link(folder)" vm-card class="flex items-center gap-3 p-4 text-foreground no-underline">
              <span class="flex min-w-0 flex-1 flex-col gap-1">
                <span class="text-base font-medium">{{ folder.name }}</span>
                <span class="text-muted-foreground">
                  {{ 'me.common.scoreCount' | tPlural: folder.scoreCount }} · {{ folder.ensemble.name }}
                </span>
              </span>
              <ng-icon name="lucideChevronRight" size="var(--mat-sys-icon-size-md)" class="shrink-0 text-muted-foreground" aria-hidden="true" />
            </a>
          </li>
        }
      </ul>
    } @else if (list.items().length > 0) {
      <div vm-card class="overflow-x-auto">
        <table vm-table>
          <thead>
            <tr>
              <th scope="col" class="px-4 py-3 text-start">{{ 'terms.folder' | transloco }}</th>
              <th scope="col" class="px-4 py-3 text-start">{{ 'terms.ensemble' | transloco }}</th>
              <th scope="col" class="w-24 px-4 py-3 text-end">{{ 'me.common.scores' | transloco }}</th>
              <th scope="col" class="w-28 px-4 py-3 text-end">{{ 'me.list.actions' | transloco }}</th>
            </tr>
          </thead>
          <tbody>
            @for (folder of list.items(); track folder.id) {
              <tr>
                <td class="px-4 py-3"><a [routerLink]="link(folder)" class="font-medium">{{ folder.name }}</a></td>
                <td class="px-4 py-3 text-muted-foreground">{{ folder.ensemble.name }}</td>
                <td class="px-4 py-3 text-end tabular-nums">{{ folder.scoreCount }}</td>
                <td class="px-4 py-3 text-end">
                  <a
                    vm-icon-button
                   
                    [href]="zip(folder)"
                    download
                    [attr.aria-label]="'me.folders.zipLabel' | transloco: { name: folder.name }"
                  >
                    <ng-icon name="lucideFileArchive" aria-hidden="true" />
                  </a>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }

    <vm-list-state [list]="list" emptyKey="me.folders.empty" />
  `,
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
