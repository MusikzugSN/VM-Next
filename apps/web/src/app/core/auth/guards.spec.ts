import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree, type ActivatedRouteSnapshot, type RouterStateSnapshot } from '@angular/router';
import type { SessionPermissions, SessionResponse } from '@vm-web/shared';

import { ApiProblem } from '../api/api-problem';
import { authGuard, guestGuard, memberGuard, requirePermission, safeReturnTo } from './guards';
import { SessionStore } from './session.store';

const user = { id: 'u1', name: 'Lena Maier', email: null, pictureUrl: null, isAdmin: false };
const signedIn = (overrides: Partial<SessionPermissions> = {}): SessionResponse => ({
  authenticated: true,
  user,
  permissions: { club: [], anyEnsemble: [], memberships: [], ensembles: [], ...overrides },
});

describe('safeReturnTo', () => {
  it.each([
    ['/me/folders/1?q=a', '/me/folders/1?q=a'],
    ['//evil.example', null],
    ['/\\evil.example', null],
    ['https://evil.example', null],
    ['', null],
    [null, null],
  ])('%s → %s', (value, expected) => {
    expect(safeReturnTo(value)).toBe(expected);
  });
});

describe('guards', () => {
  let session: { ensureLoaded: ReturnType<typeof vi.fn>; can: ReturnType<typeof vi.fn>; isMember: ReturnType<typeof vi.fn> };
  const state = { url: '/library/scores?q=marsch' } as RouterStateSnapshot;

  function run<T>(fn: () => T): T {
    return TestBed.runInInjectionContext(fn);
  }
  const url = (result: unknown) => (result instanceof UrlTree ? TestBed.inject(Router).serializeUrl(result) : result);

  beforeEach(() => {
    session = { ensureLoaded: vi.fn(), can: vi.fn(() => false), isMember: vi.fn(() => false) };
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: SessionStore, useValue: session }] });
  });

  it('authGuard lets signed-in people pass', async () => {
    session.ensureLoaded.mockResolvedValue(signedIn());
    expect(await run(() => authGuard({} as ActivatedRouteSnapshot, state))).toBe(true);
  });

  it('authGuard sends anonymous visitors to the login with returnTo', async () => {
    session.ensureLoaded.mockResolvedValue({ authenticated: false });
    expect(url(await run(() => authGuard({} as ActivatedRouteSnapshot, state)))).toBe(
      '/login?returnTo=%2Flibrary%2Fscores%3Fq%3Dmarsch',
    );
  });

  it('authGuard shows the reason on the login page when the API is unreachable', async () => {
    session.ensureLoaded.mockRejectedValue(new ApiProblem(0, 'network-error'));
    expect(url(await run(() => authGuard({} as ActivatedRouteSnapshot, state)))).toContain('error=network-error');
  });

  it('guestGuard sends signed-in people to a safe returnTo or Mein Bereich', async () => {
    session.ensureLoaded.mockResolvedValue(signedIn());
    const route = (returnTo: string | null) =>
      ({ queryParamMap: { get: () => returnTo } }) as unknown as ActivatedRouteSnapshot;
    expect(url(await run(() => guestGuard(route('/me/events'), state)))).toBe('/me/events');
    expect(url(await run(() => guestGuard(route('//evil.example'), state)))).toBe('/me');
    session.ensureLoaded.mockResolvedValue({ authenticated: false });
    expect(await run(() => guestGuard(route(null), state))).toBe(true);
  });

  it('requirePermission accepts any of the permissions, else /forbidden', () => {
    session.can.mockImplementation((p: string) => p === 'score.edit');
    const guard = requirePermission('config.view', 'score.edit');
    expect(run(() => guard({} as ActivatedRouteSnapshot, state))).toBe(true);
    session.can.mockReturnValue(false);
    expect(url(run(() => guard({} as ActivatedRouteSnapshot, state)))).toBe('/forbidden');
  });

  it('memberGuard needs a membership', () => {
    expect(url(run(() => memberGuard({} as ActivatedRouteSnapshot, state)))).toBe('/forbidden');
    session.isMember.mockReturnValue(true);
    expect(run(() => memberGuard({} as ActivatedRouteSnapshot, state))).toBe(true);
  });
});
