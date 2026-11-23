import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { onOpened } from './on-opened';

describe('onOpened', () => {
  const setup = () => {
    const open = signal(false);
    const source = signal(1);
    const reset = vi.fn(() => source());
    TestBed.runInInjectionContext(() => onOpened(open, reset));
    return { open, source, reset };
  };

  it('runs on every opening, not while closed', () => {
    const { open, reset } = setup();
    TestBed.tick();
    expect(reset).not.toHaveBeenCalled();

    open.set(true);
    TestBed.tick();
    expect(reset).toHaveBeenCalledTimes(1);

    open.set(false);
    TestBed.tick();
    open.set(true);
    TestBed.tick();
    expect(reset).toHaveBeenCalledTimes(2);
  });

  it('does not track signals read in reset', () => {
    const { open, source, reset } = setup();
    open.set(true);
    TestBed.tick();

    source.set(2);
    TestBed.tick();
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
