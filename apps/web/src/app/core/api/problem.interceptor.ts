import { Location } from '@angular/common';
import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { API_PREFIX, APP_QUERY, APP_ROUTES, appPath } from '@vm-web/shared';
import { catchError, from, switchMap, throwError } from 'rxjs';

import { ApiProblem } from './api-problem';

export function isApiRequest(url: string): boolean {
  return url.startsWith(`${API_PREFIX}/`) || url.includes(`${API_PREFIX}/`);
}

/**
 * Turns every failed API request into an `ApiProblem` and handles the two cases that are the
 * same everywhere: no session → `/login?returnTo=<current page>`, blocked account → `/blocked`.
 * Everything else (403, 404, validation) is up to the caller.
 */
export const problemInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isApiRequest(req.url)) return next(req);
  const router = inject(Router);
  const location = inject(Location);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) return throwError(() => error);
      return from(readBody(error.error)).pipe(
        switchMap((body) => {
          const problem = ApiProblem.fromResponse(error.status, body);
          if (problem.code === 'unauthenticated') {
            const current = location.path() || '/';
            if (!current.startsWith(APP_ROUTES.login)) {
              void router.navigateByUrl(appPath(APP_ROUTES.login, {}, { [APP_QUERY.returnTo]: current }));
            }
          } else if (problem.code === 'account-blocked') {
            void router.navigateByUrl(APP_ROUTES.blocked);
          }
          return throwError(() => problem);
        }),
      );
    }),
  );
};

/** Error bodies of blob/text requests arrive unparsed; Problem Details are JSON in every case. */
async function readBody(body: unknown): Promise<unknown> {
  try {
    let text: string;
    if (typeof Blob !== 'undefined' && body instanceof Blob) text = await blobText(body);
    else if (typeof body === 'string') text = body;
    else return body;
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function blobText(blob: Blob): Promise<string> {
  if (typeof blob.text === 'function') return blob.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}
