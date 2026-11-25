import { HttpClient, HttpEventType, HttpParams } from '@angular/common/http';
import { inject, Injectable, isDevMode } from '@angular/core';
import { filter, last, map, tap, type Observable } from 'rxjs';
import type { z } from 'zod';

type QueryValue = string | number | boolean | null | undefined;
export type ApiQuery = Record<string, QueryValue | readonly QueryValue[]>;

/**
 * Thin wrapper around `HttpClient` for the VM-Web API. URLs come from `apiUrl(...)` of
 * `@vm-web/shared`, types from its Zod schemas. In dev builds every response is checked against
 * its schema and mismatches are logged, so drift between API and frontend shows up early; the
 * raw body is returned in all builds, so dev and prod behave the same.
 */
@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);

  get<S extends z.ZodType>(url: string, schema: S, query: ApiQuery = {}): Observable<z.output<S>> {
    return this.http.get<unknown>(url, { params: toParams(query) }).pipe(map((body) => checked(url, schema, body)));
  }

  post<S extends z.ZodType>(url: string, body: unknown, schema: S): Observable<z.output<S>> {
    return this.http.post<unknown>(url, body ?? {}).pipe(map((res) => checked(url, schema, res)));
  }

  /** POST without response body (`204 No Content`). */
  postVoid(url: string, body: unknown = {}): Observable<void> {
    return this.http.post<unknown>(url, body).pipe(map(() => undefined));
  }

  uploadWithProgress<S extends z.ZodType>(
    url: string,
    form: FormData,
    schema: S,
    onProgress: (loaded: number) => void,
  ): Observable<z.output<S>> {
    return this.http.post<unknown>(url, form, { reportProgress: true, observe: 'events' }).pipe(
      tap((event) => {
        if (event.type === HttpEventType.UploadProgress) onProgress(event.loaded);
      }),
      filter((event) => event.type === HttpEventType.Response),
      last(),
      map((event) => schema.parse(event.body)),
    );
  }

  /** GET whose answer is a file (print PDF, D-1). */
  getBlob(url: string, query: ApiQuery = {}): Observable<Blob> {
    return this.http.get(url, { params: toParams(query), responseType: 'blob' });
  }

  /** POST whose answer is a file. */
  postBlob(url: string, body: unknown): Observable<Blob> {
    return this.http.post(url, body, { responseType: 'blob' });
  }
}

export function toParams(query: ApiQuery): HttpParams {
  let params = new HttpParams();
  for (const [key, raw] of Object.entries(query)) {
    const values = Array.isArray(raw) ? raw : [raw];
    for (const value of values) {
      if (value === null || value === undefined || value === '') continue;
      params = params.append(key, String(value));
    }
  }
  return params;
}

function checked<S extends z.ZodType>(url: string, schema: S, body: unknown): z.output<S> {
  if (isDevMode()) {
    const result = schema.safeParse(body);
    if (!result.success) console.error(`[api] Response of ${url} does not match its schema`, result.error.issues);
  }
  return body as z.output<S>;
}
