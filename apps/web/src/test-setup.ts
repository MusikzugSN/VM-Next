/**
 * Test environment (jsdom) additions for all unit tests of `web`.
 * jsdom has no `matchMedia`; ngx-sonner and the CDK BreakpointObserver need it.
 * Tests can set the simulated width with `setViewportWidth()`.
 */
let viewportWidth = 1440;
const listeners = new Set<() => void>();

export function setViewportWidth(width: number): void {
  viewportWidth = width;
  for (const listener of listeners) listener();
}

function matches(query: string): boolean {
  const min = /min-width:\s*(\d+)px/.exec(query);
  const max = /max-width:\s*(\d+)px/.exec(query);
  if (min && viewportWidth < Number(min[1])) return false;
  if (max && viewportWidth > Number(max[1])) return false;
  return Boolean(min || max) || /prefers-color-scheme:\s*light/.test(query);
}

Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  writable: true,
  value: (query: string): MediaQueryList => {
    const changeListeners = new Set<(event: MediaQueryListEvent) => void>();
    const list = {
      media: query,
      get matches() {
        return matches(query);
      },
      onchange: null,
      addEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => changeListeners.add(listener),
      removeEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => changeListeners.delete(listener),
      addListener: (listener: (event: MediaQueryListEvent) => void) => changeListeners.add(listener),
      removeListener: (listener: (event: MediaQueryListEvent) => void) => changeListeners.delete(listener),
      dispatchEvent: () => false,
    };
    listeners.add(() => {
      for (const listener of changeListeners) listener({ matches: list.matches, media: query } as MediaQueryListEvent);
    });
    return list as unknown as MediaQueryList;
  },
});
