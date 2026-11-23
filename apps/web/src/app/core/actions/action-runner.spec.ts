import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';

import { ZardSonnerService } from '@/shared/components/sonner';

import { ApiProblem } from '../api/api-problem';
import { ActionRunner } from './action-runner';

describe('ActionRunner', () => {
  const sonner = { success: vi.fn(), error: vi.fn() };
  const translate = vi.fn((key: string) => key);
  let runner: ActionRunner;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        { provide: ZardSonnerService, useValue: sonner },
        { provide: TranslocoService, useValue: { translate } },
      ],
    });
    runner = TestBed.inject(ActionRunner);
  });

  it('wraps the result, also for actions without a value', async () => {
    await expect(runner.run(async () => 7)).resolves.toEqual({ value: 7 });
    await expect(runner.run(async () => undefined)).resolves.toEqual({ value: undefined });
    expect(sonner.success).not.toHaveBeenCalled();
  });

  it('shows the success toast with its params', async () => {
    await runner.run(async () => 1, { success: { key: 'saved', params: { name: 'A' } } });
    expect(translate).toHaveBeenCalledWith('saved', { name: 'A' });
    expect(sonner.success).toHaveBeenCalledWith('saved');
  });

  it('shows the text of an API problem and returns undefined', async () => {
    const result = await runner.run(() => Promise.reject(new ApiProblem(409, 'name-taken')));
    expect(result).toBeUndefined();
    expect(sonner.error).toHaveBeenCalledWith('errors.name-taken');
  });

  it('falls back to errors.unknown or the given key for other failures', async () => {
    await runner.run(() => Promise.reject(new Error('boom')));
    await runner.run(() => Promise.reject(new Error('boom')), { fallbackKey: 'zip.failed' });
    expect(sonner.error.mock.calls).toEqual([['errors.unknown'], ['zip.failed']]);
  });

  it('keeps the API problem text when a fallback key is given', async () => {
    await runner.run(() => Promise.reject(new ApiProblem(403, 'forbidden')), { fallbackKey: 'zip.failed' });
    expect(sonner.error).toHaveBeenCalledWith('errors.forbidden');
  });

  it('skips the toast only when onProblem returns true', async () => {
    await runner.run(() => Promise.reject(new Error('a')), { onProblem: () => true });
    expect(sonner.error).not.toHaveBeenCalled();
    await runner.run(() => Promise.reject(new Error('b')), { onProblem: () => false });
    expect(sonner.error).toHaveBeenCalledOnce();
  });
});
