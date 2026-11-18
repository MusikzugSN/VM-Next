import { Pipe, type PipeTransform } from '@angular/core';

/** Non-breaking space: native options collapse normal spaces. */
const NBSP = String.fromCharCode(0xa0);
const INDENT = NBSP.repeat(4);

/**
 * Label of an ensemble in a native `<option>` (F-3): indented by `depth` with a branch mark, so the
 * tree stays visible in every selection. Native options cannot take padding, hence the spaces.
 * `{{ ensemble | treeLabel }}` → „Verein“, „    └ Hauptorchester“, „        └ Brass“.
 */
export function treeLabel(option: { name: string; depth?: number }): string {
  const depth = option.depth ?? 0;
  return depth > 0 ? `${INDENT.repeat(depth - 1)}${NBSP}${NBSP}└${NBSP}${option.name}` : option.name;
}

@Pipe({ name: 'treeLabel' })
export class TreeLabelPipe implements PipeTransform {
  transform(option: { name: string; depth?: number }): string {
    return treeLabel(option);
  }
}
