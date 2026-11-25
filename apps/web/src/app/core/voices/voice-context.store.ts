import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { apiUrl, voiceContextResponseSchema, voiceOptionsResponseSchema } from '@vm-web/shared';

import { ApiClient } from '../api/api-client';
import { SessionStore } from '../auth/session.store';
import { isStandIn } from './voice-groups';
import { ignoreStorageErrors, readStoredStrings } from '../util/stored';
import { selectOr, valueOr } from '../util/resource-value';

const OVERRIDE_KEY = 'vmweb.voiceOverride';
/** API limit for `?voiceId=` (repeatable, max. 20). */
const MAX_OVERRIDE_VOICES = 20;

/**
 * Active voices for Mein Bereich (M-1, M-2): the profile voices or a temporary override, e.g.
 * as a stand-in. The override lives in the browser tab only (sessionStorage) and never changes
 * the profile. Every `me` request passes `overrideIds()` as `voiceId`.
 */
@Injectable({ providedIn: 'root' })
export class VoiceContextStore {
  private readonly api = inject(ApiClient);
  private readonly session = inject(SessionStore);

  /** Voice ids that replace the profile voices; empty = profile voices. */
  readonly overrideIds = signal<readonly string[]>(readOverride());

  private readonly contextResource = rxResource({
    params: () => (this.session.isMember() ? { voiceId: this.overrideIds() } : undefined),
    stream: ({ params }) => this.api.get(apiUrl('me', 'voiceContext'), voiceContextResponseSchema, params),
  });

  private readonly optionsResource = rxResource({
    params: () => (this.session.isMember() ? true : undefined),
    stream: () => this.api.get(apiUrl('me', 'voiceOptions'), voiceOptionsResponseSchema),
  });

  readonly context = computed(() => valueOr(this.contextResource, null));
  readonly options = computed(() => selectOr(this.optionsResource, (v) => v.groups, []));
  readonly activeVoices = computed(() => this.context()?.activeVoices ?? []);
  readonly profileVoices = computed(() => this.context()?.profileVoices ?? []);
  readonly isOverride = computed(() => this.context()?.isOverride ?? false);
  /** „Aushilfe“: an active voice that is not one of the own profile voices (M-2). */
  readonly isStandIn = computed(() => isStandIn(this.activeVoices(), this.profileVoices()));
  readonly needsVoiceSelection = computed(() => this.context()?.needsVoiceSelection ?? false);

  constructor() {
    effect(() => writeOverride(this.overrideIds()));
  }

  /** Show only these voices for now (M-2); `[]` returns to the profile voices. */
  setOverride(voiceIds: readonly string[]): void {
    this.overrideIds.set([...new Set(voiceIds)].slice(0, MAX_OVERRIDE_VOICES));
  }

  clearOverride(): void {
    this.overrideIds.set([]);
  }

  /** After the profile voices changed (M-1). */
  reload(): void {
    this.contextResource.reload();
  }

  /** After instruments or voices were created (e.g. lineup template, N-8). */
  reloadOptions(): void {
    this.optionsResource.reload();
  }
}

function readOverride(): string[] {
  return readStoredStrings(() => sessionStorage, OVERRIDE_KEY);
}

/** With blocked storage (private mode) the override lasts until the next reload. */
function writeOverride(ids: readonly string[]): void {
  ignoreStorageErrors(() => {
    if (ids.length) sessionStorage.setItem(OVERRIDE_KEY, JSON.stringify(ids));
    else sessionStorage.removeItem(OVERRIDE_KEY);
  });
}
