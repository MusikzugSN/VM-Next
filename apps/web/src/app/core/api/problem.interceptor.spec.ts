import { Location } from '@angular/common';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { apiUrl } from '@vm-web/shared';
import { firstValueFrom } from 'rxjs';

import { ApiProblem } from './api-problem';
import { isApiRequest, problemInterceptor } from './problem.interceptor';

describe('problemInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  const navigateByUrl = vi.fn(() => Promise.resolve(true));
  let currentPath = '/me/folders/f1?q=marsch';

  const url = apiUrl('me', 'folders');
  const problemBody = (status: number, code: string, errors?: { path: string; code: string }[]) => ({
    type: `urn:vm-web:problem:${code}`,
    title: 't',
    status,
    code,
    errors,
  });

  async function fail(status: number, body: object | string, requestUrl = url): Promise<unknown> {
    const result = firstValueFrom(http.get(requestUrl)).catch((error: unknown) => error);
    controller.expectOne(requestUrl).flush(body, { status, statusText: 'x' });
    return result;
  }

  beforeEach(() => {
    navigateByUrl.mockClear();
    currentPath = '/me/folders/f1?q=marsch';
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([problemInterceptor])),
        provideHttpClientTesting(),
        { provide: Router, useValue: { navigateByUrl } },
        { provide: Location, useValue: { path: () => currentPath } },
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('turns validation errors into an ApiProblem with field errors', async () => {
    const error = await fail(400, problemBody(400, 'validation-failed', [{ path: '/body/name', code: 'too_small' }]));
    expect(error).toBeInstanceOf(ApiProblem);
    expect((error as ApiProblem).fieldErrors()).toEqual({ name: 'too_small' });
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it('sends a missing session to the login with the current page as returnTo', async () => {
    const error = await fail(401, problemBody(401, 'unauthenticated'));
    expect((error as ApiProblem).code).toBe('unauthenticated');
    expect(navigateByUrl).toHaveBeenCalledWith('/login?returnTo=%2Fme%2Ffolders%2Ff1%3Fq%3Dmarsch');
  });

  it('does not redirect again while on the login page', async () => {
    currentPath = '/login?returnTo=%2Fme';
    await fail(401, problemBody(401, 'unauthenticated'));
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it('sends blocked accounts to /blocked', async () => {
    await fail(403, problemBody(403, 'account-blocked'));
    expect(navigateByUrl).toHaveBeenCalledWith('/blocked');
  });

  it('leaves 403 and 404 to the caller', async () => {
    expect(((await fail(403, problemBody(403, 'forbidden'))) as ApiProblem).code).toBe('forbidden');
    expect(((await fail(404, problemBody(404, 'not-found'))) as ApiProblem).code).toBe('not-found');
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it('reads Problem Details from blob error bodies (downloads)', async () => {
    const blobUrl = apiUrl('me', 'sheetPdf', { sheetId: 's1' });
    const result = firstValueFrom(http.get(blobUrl, { responseType: 'blob' })).catch((error: unknown) => error);
    const body = new Blob([JSON.stringify(problemBody(404, 'not-found'))], { type: 'application/problem+json' });
    controller.expectOne(blobUrl).flush(body, { status: 404, statusText: 'x' });
    expect(((await result) as ApiProblem).code).toBe('not-found');
  });

  it('reports network failures', async () => {
    const result = firstValueFrom(http.get(url)).catch((error: unknown) => error);
    controller.expectOne(url).error(new ProgressEvent('error'), { status: 0 });
    expect(((await result) as ApiProblem).code).toBe('network-error');
  });

  it('leaves other requests untouched', async () => {
    const error = await fail(404, 'missing', '/translate/de-DE/global.json');
    expect(error).not.toBeInstanceOf(ApiProblem);
  });
});

describe('isApiRequest', () => {
  it('recognises API paths only', () => {
    expect(isApiRequest('/internal/v1/me/folders')).toBe(true);
    expect(isApiRequest('http://localhost:4200/internal/v1/auth/session')).toBe(true);
    expect(isApiRequest('/translate/de-DE/global.json')).toBe(false);
  });
});
