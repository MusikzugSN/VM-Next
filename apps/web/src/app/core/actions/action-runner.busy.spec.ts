import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';

import { ZardSonnerService } from '@vm-web/ui/zard/components/sonner';

import { ActionRunner } from './action-runner';

describe('ActionRunner busy flag', () => {
  let runner: ActionRunner;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: ZardSonnerService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: TranslocoService, useValue: { translate: (key: string) => key } },
      ],
    });
    runner = TestBed.inject(ActionRunner);
  });

  it('is set while the action runs and reset after success', async () => {
    const busy = signal(false);
    let during = false;
    await runner.run(
      async () => {
        during = busy();
      },
      { busy },
    );
    expect(during).toBe(true);
    expect(busy()).toBe(false);
  });

  it('is still set during onProblem and reset after a failure', async () => {
    const busy = signal(false);
    let during = false;
    await runner.run(() => Promise.reject(new Error('boom')), {
      busy,
      onProblem: () => {
        during = busy();
        return true;
      },
    });
    expect(during).toBe(true);
    expect(busy()).toBe(false);
  });
});
