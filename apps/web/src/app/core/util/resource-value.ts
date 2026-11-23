import type { Resource } from '@angular/core';

/**
 * The value of a resource, or the fallback while it has none. `value()` itself throws in the
 * error state, so reading it needs the `hasValue()` guard.
 */
export function valueOr<T, F>(resource: Resource<T>, fallback: F): Exclude<T, undefined> | F {
  return resource.hasValue() ? (resource.value() as Exclude<T, undefined>) : fallback;
}

/** Like `valueOr`, for a part of the value. */
export function selectOr<T, R, F>(resource: Resource<T>, select: (value: Exclude<T, undefined>) => R, fallback: F): R | F {
  return resource.hasValue() ? select(resource.value() as Exclude<T, undefined>) : fallback;
}
