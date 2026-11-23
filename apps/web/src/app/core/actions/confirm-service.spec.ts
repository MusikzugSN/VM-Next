import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { of, throwError } from 'rxjs';

import { ZardAlertDialogService } from '@/shared/components/alert-dialog';
import { ZardSonnerService } from '@/shared/components/sonner';

import { ConfirmService } from './action-runner';

interface ConfirmConfig {
  zTitle: string;
  zOnOk: () => void;
  zOnCancel: () => void;
}

describe('ConfirmService.confirmedDelete', () => {
  const sonner = { success: vi.fn(), error: vi.fn() };
  const confirm = vi.fn<(config: ConfirmConfig) => void>();
  let service: ConfirmService;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        { provide: ZardSonnerService, useValue: sonner },
        { provide: ZardAlertDialogService, useValue: { confirm } },
        { provide: TranslocoService, useValue: { translate: (key: string) => key } },
      ],
    });
    service = TestBed.inject(ConfirmService);
  });

  it('does not run the action when cancelled', async () => {
    confirm.mockImplementation((config) => config.zOnCancel());
    const request = vi.fn(() => of(undefined));

    await expect(service.confirmedDelete('title', 'text', {}, request)).resolves.toBeUndefined();
    expect(request).not.toHaveBeenCalled();
    expect(sonner.success).not.toHaveBeenCalled();
  });

  it('runs the action after confirming and shows the success toast', async () => {
    confirm.mockImplementation((config) => config.zOnOk());

    const result = await service.confirmedDelete('title', 'text', { name: 'A' }, () => of(1), { success: { key: 'deleted' } });

    expect(result).toEqual({ value: 1 });
    expect(sonner.success).toHaveBeenCalledWith('deleted');
  });

  it('returns undefined and shows the error when the deletion fails', async () => {
    confirm.mockImplementation((config) => config.zOnOk());

    await expect(service.confirmedDelete('title', 'text', {}, () => throwError(() => new Error('boom')))).resolves.toBeUndefined();
    expect(sonner.error).toHaveBeenCalledWith('errors.unknown');
  });
});
