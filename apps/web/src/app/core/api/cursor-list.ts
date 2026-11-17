import { computed, DestroyRef, effect, inject, signal, untracked, type Signal } from '@angular/core';
import type { Page } from '@vm-web/shared';
import type { Observable, Subscription } from 'rxjs';

import { ApiProblem } from './api-problem';

export interface CursorList<T> {
  readonly items: Signal<readonly T[]>;
  /** A page is being loaded (first page or „Mehr laden“). */
  readonly loading: Signal<boolean>;
  /** The first page has arrived at least once. */
  readonly loaded: Signal<boolean>;
  readonly error: Signal<ApiProblem | null>;
  readonly hasMore: Signal<boolean>;
  /** Loads the first page again with the current parameters. */
  reload(): void;
  /** Appends the next page; does nothing while loading or at the end. */
  loadMore(): void;
}

export interface CursorListOptions<P, T> {
  /** Reactive parameters (search, filters); a change reloads the list from the first page. */
  params: () => P;
  fetch: (params: P, cursor: string | undefined) => Observable<Page<T>>;
}

/**
 * State of a cursor-paginated list (`{ items, nextCursor }`) as signals. Loads the first page
 * right away and again whenever `params()` changes; a newer request always wins over an older
 * one. Must be created in an injection context (component field, service constructor).
 */
export function cursorList<P, T>(options: CursorListOptions<P, T>): CursorList<T> {
  const items = signal<readonly T[]>([]);
  const nextCursor = signal<string | null>(null);
  const loading = signal(false);
  const loaded = signal(false);
  const error = signal<ApiProblem | null>(null);
  let running: Subscription | undefined;

  const load = (append: boolean) => {
    running?.unsubscribe();
    const params = untracked(options.params);
    const cursor = append ? (untracked(nextCursor) ?? undefined) : undefined;
    loading.set(true);
    error.set(null);
    running = options.fetch(params, cursor).subscribe({
      next: (page) => {
        items.update((current) => (append ? [...current, ...page.items] : page.items));
        nextCursor.set(page.nextCursor);
        loaded.set(true);
        loading.set(false);
      },
      error: (err: unknown) => {
        error.set(err instanceof ApiProblem ? err : new ApiProblem(0, 'unknown'));
        loading.set(false);
      },
    });
  };

  effect(() => {
    options.params();
    load(false);
  });
  inject(DestroyRef).onDestroy(() => running?.unsubscribe());

  return {
    items: items.asReadonly(),
    loading: loading.asReadonly(),
    loaded: loaded.asReadonly(),
    error: error.asReadonly(),
    hasMore: computed(() => nextCursor() !== null),
    reload: () => load(false),
    loadMore: () => {
      if (untracked(loading) || untracked(nextCursor) === null) return;
      load(true);
    },
  };
}
