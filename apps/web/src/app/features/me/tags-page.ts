import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucidePencil, lucidePlus, lucideSearch, lucideTrash2 } from '@ng-icons/lucide';
import {
  APP_ROUTES,
  apiUrl,
  appPath,
  createdResponseSchema,
  myTagScoresResponseSchema,
  myTagsResponseSchema,
  type MyTagItem,
} from '@vm-web/shared';
import { firstValueFrom, of } from 'rxjs';

import { ZardAlertDialogService } from '@/shared/components/alert-dialog';
import { ZardButtonComponent } from '@/shared/components/button';
import { ZardInputComponent } from '@/shared/components/input';
import { ZardSonnerService } from '@/shared/components/sonner';

import { ApiClient } from '../../core/api/api-client';
import { isApiProblem } from '../../core/api/api-problem';
import { cursorList } from '../../core/api/cursor-list';
import { debounced } from '../../core/util/debounced';
import { VoiceContextStore } from '../../core/voices/voice-context.store';
import { ListState } from '../../shared/ui/list-state';
import { MemberScoreList } from './ui/member-score-list';
import { NameForm } from '../../shared/ui/name-form';

export type TagKind = 'club' | 'personal';

/** Tags (M-8): club tags and own personal tags as filters; selecting one lists its scores. */
@Component({
  selector: 'vm-me-tags-page',
  imports: [RouterLink, NgIcon, TranslocoPipe, ZardButtonComponent, ZardInputComponent, ListState, MemberScoreList, NameForm],
  viewProviders: [provideIcons({ lucidePlus, lucideSearch, lucidePencil, lucideTrash2 })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tags-page.html',
})
export class TagsPage {
  private readonly api = inject(ApiClient);
  private readonly voices = inject(VoiceContextStore);
  private readonly router = inject(Router);
  private readonly sonner = inject(ZardSonnerService);
  private readonly alerts = inject(ZardAlertDialogService);
  private readonly transloco = inject(TranslocoService);

  /** Route parameter and route data (`kind`). */
  readonly tagId = input<string>();
  readonly kind = input<TagKind>();

  protected readonly tagsPath = APP_ROUTES.me.tags;
  protected readonly creating = signal(false);
  protected readonly renaming = signal(false);
  protected readonly search = signal('');
  private readonly query = debounced(this.search);

  protected readonly tags = rxResource({ stream: () => this.api.get(apiUrl('me', 'tags'), myTagsResponseSchema) });

  protected readonly selected = computed(() => {
    const id = this.tagId();
    const kind = this.kind();
    if (!id || !kind || !this.tags.hasValue()) return null;
    const list = kind === 'club' ? this.tags.value().clubTags : this.tags.value().personalTags;
    const tag = list.find((item) => item.id === id);
    return tag ? { kind, tag } : null;
  });

  protected readonly list = cursorList({
    params: () => ({ id: this.tagId(), kind: this.kind(), voiceId: this.voices.overrideIds(), q: this.query().trim() }),
    fetch: (p, cursor) => {
      if (!p.id || !p.kind) return of({ items: [], nextCursor: null });
      const url =
        p.kind === 'club' ? apiUrl('me', 'clubTagScores', { tagId: p.id }) : apiUrl('me', 'personalTagScores', { tagId: p.id });
      return this.api.get(url, myTagScoresResponseSchema, { cursor, voiceId: p.voiceId, q: p.q });
    },
  });

  protected link(kind: TagKind, tag: MyTagItem): string {
    return appPath(kind === 'club' ? APP_ROUTES.me.clubTag : APP_ROUTES.me.personalTag, { tagId: tag.id });
  }

  protected async create(name: string): Promise<void> {
    const created = await this.run(() => firstValueFrom(this.api.post(apiUrl('me', 'createPersonalTag'), { name }, createdResponseSchema)));
    if (!created) return;
    this.creating.set(false);
    this.tags.reload();
    void this.router.navigateByUrl(appPath(APP_ROUTES.me.personalTag, { tagId: created.id }));
  }

  protected async rename(name: string): Promise<void> {
    const id = this.tagId();
    if (!id) return;
    const ok = await this.run(() => firstValueFrom(this.api.postVoid(apiUrl('me', 'renamePersonalTag', { tagId: id }), { name })));
    if (ok === undefined) return;
    this.renaming.set(false);
    this.tags.reload();
  }

  protected remove(tag: MyTagItem): void {
    this.alerts.confirm({
      zTitle: this.transloco.translate('me.tags.deleteTitle', { name: tag.name }),
      zDescription: this.transloco.translate('me.tags.deleteText'),
      zOkText: this.transloco.translate('common.delete'),
      zCancelText: this.transloco.translate('common.cancel'),
      zOkDestructive: true,
      zOnOk: () => {
        void this.run(() => firstValueFrom(this.api.postVoid(apiUrl('me', 'deletePersonalTag', { tagId: tag.id })))).then((ok) => {
          if (ok === undefined) return;
          this.sonner.success(this.transloco.translate('me.tags.deleted', { name: tag.name }));
          this.tags.reload();
          void this.router.navigateByUrl(APP_ROUTES.me.tags);
        });
      },
    });
  }

  /** Runs an action; on failure shows the problem as toast and returns `undefined`. */
  private async run<T>(action: () => Promise<T>): Promise<T | undefined> {
    try {
      return (await action()) ?? (true as T);
    } catch (error) {
      this.sonner.error(this.transloco.translate(isApiProblem(error) ? error.messageKey : 'errors.unknown'));
      return undefined;
    }
  }
}
