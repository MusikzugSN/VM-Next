/**
 * Calls `onChange` once per animation frame when the element's width changes. PDF previews fit the
 * page to the width; reacting to height changes (caused by the rendered page itself) or rendering
 * inside the observer callback makes the browser report „ResizeObserver loop completed with
 * undelivered notifications“. Returns the cleanup.
 */
export function observeWidth(element: Element, onChange: () => void): () => void {
  let width: number | null = null;
  let frame = 0;
  const observer = new ResizeObserver((entries) => {
    const next = Math.round(entries[entries.length - 1]?.contentRect.width ?? 0);
    if (next === width) return;
    width = next;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(onChange);
  });
  observer.observe(element);
  return () => {
    cancelAnimationFrame(frame);
    observer.disconnect();
  };
}
