import { HttpEventType, provideHttpClient } from '@angular/common/http';
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

  it('uploads a form, reports progress and parses the result', async () => {
    const api = TestBed.inject(ApiClient);
    const controller = TestBed.inject(HttpTestingController);
    const form = new FormData();
    form.append('file', new Blob(['%PDF']), 'a.pdf');
    const progress: number[] = [];

    const result = firstValueFrom(api.uploadWithProgress('/internal/v1/upload', form, schema, (loaded) => progress.push(loaded)));
    const request = controller.expectOne('/internal/v1/upload');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBe(form);
    request.event({ type: HttpEventType.UploadProgress, loaded: 10, total: 40 });
    request.event({ type: HttpEventType.UploadProgress, loaded: 40, total: 40 });
    request.flush({ name: 'Marschbuch' });

    expect(await result).toEqual({ name: 'Marschbuch' });
    expect(progress).toEqual([10, 40]);
  });

  it('rejects an upload result that does not match its schema', async () => {
    const api = TestBed.inject(ApiClient);
    const controller = TestBed.inject(HttpTestingController);

    const result = firstValueFrom(api.uploadWithProgress('/internal/v1/upload', new FormData(), schema, () => undefined));
    controller.expectOne('/internal/v1/upload').flush({ title: 'Marschbuch' });

    await expect(result).rejects.toBeInstanceOf(z.ZodError);
  });
});
