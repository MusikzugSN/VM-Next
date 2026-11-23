import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { of, throwError } from 'rxjs';

import { ZardSonnerService } from '@vm-web/ui/zard/components/sonner';

import { ActionRunner } from './action-runner';

describe('ActionRunner.runOnce', () => {
  const sonner = { success: vi.fn(), error: vi.fn() };
  let runner: ActionRunner;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        { provide: ZardSonnerService, useValue: sonner },
        { provide: TranslocoService, useValue: { translate: (key: string) => key } },
      ],
    });
    runner = TestBed.inject(ActionRunner);
  });

  it('returns the first value of the request', async () => {
    await expect(runner.runOnce(() => of(1, 2))).resolves.toEqual({ value: 1 });
  });

  it('turns a failed request into a toast', async () => {
    await expect(runner.runOnce(() => throwError(() => new Error('boom')))).resolves.toBeUndefined();
    expect(sonner.error).toHaveBeenCalledWith('errors.unknown');
  });

  it('also catches errors while the request is built, e.g. a missing path parameter', async () => {
    const result = await runner.runOnce(() => {
      throw new Error('Missing path parameter');
    });
    expect(result).toBeUndefined();
    expect(sonner.error).toHaveBeenCalledWith('errors.unknown');
  });
});
