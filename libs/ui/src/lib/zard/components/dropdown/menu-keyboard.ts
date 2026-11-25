export const ZARD_MENU_ITEM_SELECTOR = [
  'dropdown-menu-item',
  'dropdown-menu-checkbox-item',
  'dropdown-menu-radio-item',
  'dropdown-menu-sub-trigger',
]
  .map(slot => `[data-slot="${slot}"]`)
  .join(', ');

export function getMenuItems(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(ZARD_MENU_ITEM_SELECTOR)).filter(
    item => item.dataset['disabled'] === undefined,
  );
}

export function highlightMenuItem(items: HTMLElement[], index: number): void {
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (i === index) {
      item.focus();
      item.dataset['highlighted'] = '';
    } else {
      delete item.dataset['highlighted'];
    }
  }
}

export function nextMenuIndex(items: HTMLElement[], from: number, direction: number): number {
  if (items.length === 0) {
    return -1;
  }
  if (from === -1) {
    return direction > 0 ? 0 : items.length - 1;
  }

  const next = from + direction;
  if (next < 0) {
    return items.length - 1;
  }
  if (next >= items.length) {
    return 0;
  }
  return next;
}

export function findMenuItemByChar(items: HTMLElement[], char: string, from: number): number {
  const needle = char.toLowerCase();

  for (let step = 1; step <= items.length; step++) {
    const index = (Math.max(from, -1) + step) % items.length;
    if (items[index].textContent?.trim().toLowerCase().startsWith(needle)) {
      return index;
    }
  }

  return -1;
}

export function isTypeaheadKey(event: KeyboardEvent): boolean {
  return event.key.length === 1 && event.key !== ' ' && !event.ctrlKey && !event.metaKey && !event.altKey;
}

export function bindMenuPointer(surface: HTMLElement, onHighlight: (index: number) => void): () => void {
  const rowOf = (target: EventTarget | null): HTMLElement | null => {
    const row = target instanceof Element ? target.closest<HTMLElement>(ZARD_MENU_ITEM_SELECTOR) : null;
    return row && surface.contains(row) ? row : null;
  };

  const onPointerMove = (event: PointerEvent) => {
    const row = rowOf(event.target);
    if (!row || row.dataset['disabled'] !== undefined || row.ownerDocument.activeElement === row) {
      return;
    }

    const index = getMenuItems(surface).indexOf(row);
    if (index !== -1) {
      onHighlight(index);
    }
  };

  const onPointerOut = (event: PointerEvent) => {
    const row = rowOf(event.target);
    if (!row || row.contains(event.relatedTarget as Node | null) || row.getAttribute('aria-expanded') === 'true') {
      return;
    }

    delete row.dataset['highlighted'];
    if (row.ownerDocument.activeElement === row) {
      surface.focus({ preventScroll: true });
    }
    onHighlight(-1);
  };

  surface.addEventListener('pointermove', onPointerMove);
  surface.addEventListener('pointerout', onPointerOut);

  return () => {
    surface.removeEventListener('pointermove', onPointerMove);
    surface.removeEventListener('pointerout', onPointerOut);
  };
}
