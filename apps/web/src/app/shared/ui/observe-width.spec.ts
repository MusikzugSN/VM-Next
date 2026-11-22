import { observeWidth } from './observe-width';

describe('observeWidth', () => {
  let report: (width: number) => void;
  const disconnect = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: ResizeObserverCallback) {
          report = (width) => callback([{ contentRect: { width } } as ResizeObserverEntry], this as unknown as ResizeObserver);
        }
        observe(): void {
          /* reported by hand */
        }
        disconnect = disconnect;
      },
    );
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(0), 16) as unknown as number);
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('renders once per width change, in the next frame, and ignores height-only changes', () => {
    const onChange = vi.fn();
    const stop = observeWidth(document.createElement('div'), onChange);

    report(400);
    expect(onChange).not.toHaveBeenCalled();
    vi.advanceTimersByTime(16);
    expect(onChange).toHaveBeenCalledTimes(1);

    report(400.2); // only the height changed (same rounded width)
    vi.advanceTimersByTime(16);
    expect(onChange).toHaveBeenCalledTimes(1);

    report(500);
    report(520);
    vi.advanceTimersByTime(16);
    expect(onChange).toHaveBeenCalledTimes(2);

    stop();
    expect(disconnect).toHaveBeenCalled();
  });
});
