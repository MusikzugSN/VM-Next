import { DestroyRef, effect, inject, signal, type Signal } from '@angular/core';

/** A signal that follows `source` after `ms` without changes (search fields). Needs an injection context. */
export function debounced<T>(source: Signal<T>, ms = 300): Signal<T> {
  const result = signal(source());
  let timer: ReturnType<typeof setTimeout> | undefined;
  effect(() => {
    const value = source();
    clearTimeout(timer);
    timer = setTimeout(() => result.set(value), ms);
  });
  inject(DestroyRef).onDestroy(() => clearTimeout(timer));
  return result.asReadonly();
}
