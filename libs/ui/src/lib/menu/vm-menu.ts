import { ZardSonnerComponent, ZardSonnerService } from '../zard/components/sonner';
import { ZardDropdownImports } from '../zard/components/dropdown/dropdown.imports';

/**
 * M3-Menü: `[vm-menu-trigger]`, `vm-menu-content`, `[vm-menu-item]` und weitere `vm-menu-*`-Teile.
 * Verhalten und Tastatursteuerung kommen aus dem Zard-Dropdown.
 */
export const VmMenuImports = ZardDropdownImports;

/** M3-Snackbar, einmal in der App-Shell eingebunden. */
export { ZardSonnerComponent as VmToaster };

/** Zeigt Snackbars aus dem Code. */
export { ZardSonnerService as VmToastService };
