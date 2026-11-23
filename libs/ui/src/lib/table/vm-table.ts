import { Directive } from '@angular/core';

/**
 * M3-Datentabelle auf dem nativen `<table>`: Kopf, Trennlinien und Zeilen-Hover kommen von hier,
 * Spaltenbreiten und Abstände bleiben an den Zellen. Ausgewählte Zeilen behalten ihre Fläche beim Hover.
 */
@Directive({
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: 'table[vm-table]',
  host: {
    class:
      'w-full text-body-medium text-on-surface [&>thead]:bg-surface-container [&>thead]:text-label-medium [&>thead]:text-on-surface-variant [&>tbody>tr]:border-t [&>tbody>tr]:border-outline-variant [&>tbody>tr]:transition-colors [&>tbody>tr:not(.bg-primary-soft):hover]:bg-on-surface/8',
  },
})
export class VmTable {}
