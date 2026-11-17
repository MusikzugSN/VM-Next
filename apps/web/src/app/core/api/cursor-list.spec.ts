import { Injector, runInInjectionContext, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Page } from '@vm-web/shared';
import { Subject } from 'rxjs';

import { ApiProblem } from './api-problem';
import { cursorList, type CursorList } from './cursor-list';

describe('cursorList', () => {
  let requests: { params: string; cursor: string | undefined; response: Subject<Page<string>> }[];
  let search: ReturnType<typeof signal<string>>;
  let list: CursorList<string>;

  const respond = (index: number, items: string[], nextCursor: string | null) => {
    requests[index].response.next({ items, nextCursor });
    requests[index].response.complete();
  };

  beforeEach(() => {
    requests = [];
    search = signal('');
    runInInjectionContext(TestBed.inject(Injector), () => {
      list = cursorList({
        params: () => search(),
        fetch: (params, cursor) => {
          const response = new Subject<Page<string>>();
          requests.push({ params, cursor, response });
          return response;
        },
      });
    });
    TestBed.tick();
  });

  it('loads the first page right away', () => {
    expect(requests).toHaveLength(1);
    expect(list.loading()).toBe(true);
    respond(0, ['a', 'b'], 'c1');
    expect(list.items()).toEqual(['a', 'b']);
    expect(list.loaded()).toBe(true);
    expect(list.hasMore()).toBe(true);
    expect(list.loading()).toBe(false);
  });

  it('appends the next page with the cursor', () => {
    respond(0, ['a'], 'c1');
    list.loadMore();
    expect(requests[1].cursor).toBe('c1');
    respond(1, ['b'], null);
    expect(list.items()).toEqual(['a', 'b']);
    expect(list.hasMore()).toBe(false);
    list.loadMore();
    expect(requests).toHaveLength(2);
  });

  it('reloads from the first page when the parameters change; the newer request wins', () => {
    search.set('marsch');
    TestBed.tick();
    expect(requests[1]).toMatchObject({ params: 'marsch', cursor: undefined });
    respond(0, ['old'], null);
    respond(1, ['new'], null);
    expect(list.items()).toEqual(['new']);
  });

  it('keeps errors as ApiProblem', () => {
    requests[0].response.error(new ApiProblem(404, 'not-found'));
    expect(list.error()?.code).toBe('not-found');
    expect(list.loading()).toBe(false);
  });
});
