import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import * as z from 'zod';

import { ApiClient, toParams } from './api-client';

describe('toParams', () => {
  it('drops empty values and repeats arrays', () => {
    expect(toParams({ q: 'marsch', limit: 50, empty: '', none: null, tagIds: ['a', 'b'], flag: false }).toString()).toBe(
      'q=marsch&limit=50&tagIds=a&tagIds=b&flag=false',
    );
  });
});

describe('ApiClient', () => {
  const schema = z.object({ name: z.string() });

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  });

  it('returns the body and logs schema mismatches in dev mode', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const api = TestBed.inject(ApiClient);
    const controller = TestBed.inject(HttpTestingController);

    const ok = firstValueFrom(api.get('/internal/v1/x', schema, { q: 'a' }));
    controller.expectOne('/internal/v1/x?q=a').flush({ name: 'Marschbuch' });
    expect(await ok).toEqual({ name: 'Marschbuch' });
    expect(error).not.toHaveBeenCalled();

    const drift = firstValueFrom(api.get('/internal/v1/x', schema));
    controller.expectOne('/internal/v1/x').flush({ title: 'Marschbuch' });
    expect(await drift).toEqual({ title: 'Marschbuch' });
    expect(error).toHaveBeenCalledWith(expect.stringContaining('/internal/v1/x'), expect.any(Array));
    error.mockRestore();
  });
});
