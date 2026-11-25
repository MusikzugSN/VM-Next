import { CSRF_COOKIE, CSRF_HEADER, sessionResponseSchema, SESSION_COOKIE } from '@vm-web/shared';
import { Readable } from 'node:stream';
import { LOGIN_COOKIE } from '../access/cookies';
import { LegalService } from '../legal/legal.service';
import { ClubSettingsRepository } from '../settings/club-settings.repository';
import { FILE_STORAGE } from '../storage/file-storage';
import { ENS, PEOPLE, roleIdOf, type PersonKey } from '../testing/access-fixtures';
import { createTestApp, type TestApp } from '../testing/test-app';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OIDC_CLIENT, type IdentityClaims, type IOidcClient } from './oidc.client';
import { USERS_REPOSITORY, type IUsersRepository, type LoginUser } from './users.repository';

/** Fake identity server: every login request gets a predictable state; `completeLogin` checks it. */
class FakeOidc implements IOidcClient {
  next: { claims?: IdentityClaims; error?: Error } = {};
  private counter = 0;

  async createLoginRequest() {
    this.counter++;
    return {
      url: `http://idp.test/authorize?state=state-${this.counter}`,
      state: `state-${this.counter}`,
      nonce: `nonce-${this.counter}`,
      codeVerifier: `verifier-${this.counter}`,
    };
  }

  async completeLogin(query: string, checks: { state: string; nonce: string; codeVerifier: string }) {
    expect(query).toContain(`state=${checks.state}`);
    expect(checks.nonce).toBe(checks.state.replace('state', 'nonce'));
    if (this.next.error) throw this.next.error;
    if (!this.next.claims) throw new Error('no claims prepared');
    return this.next.claims;
  }
}

/** Maps identity-server subjects to fixture people. */
class FakeUsers implements IUsersRepository {
  calls: IdentityClaims[] = [];
  async upsertOnLogin(claims: IdentityClaims): Promise<LoginUser> {
    this.calls.push(claims);
    const p = PEOPLE[claims.sub as PersonKey];
    return { id: p.user.id, status: p.user.status, created: false, isAdmin: p.user.isAdmin };
  }
}

const settings = {
  clubName: 'Musikzug Test',
  loginBanner: 'Willkommen',
  loginAutoRedirect: false,
  logoFileKey: 'branding/logo.png',
  logoMime: 'image/png',
};

const legalLinks = {
  imprint: { kind: 'external', href: 'https://example.org/impressum' },
  privacy: { kind: 'internal', href: '/datenschutz' },
};

describe('AuthController (BFF login)', () => {
  let t: TestApp;
  const oidc = new FakeOidc();
  const users = new FakeUsers();

  beforeAll(async () => {
    t = await createTestApp(
      { controllers: [AuthController], providers: [AuthService] },
      {
        providers: [
          { provide: OIDC_CLIENT, useValue: oidc },
          { provide: USERS_REPOSITORY, useValue: users },
          { provide: ClubSettingsRepository, useValue: { get: async () => settings } },
          { provide: LegalService, useValue: { links: async () => legalLinks } },
          {
            provide: FILE_STORAGE,
            useValue: { read: async (key: string) => Readable.from([Buffer.from(`png:${key}`)]) },
          },
        ],
      },
    );
  });
  afterAll(() => t.close());

  const get = (path: string, headers: Record<string, string> = {}) =>
    fetch(`${t.baseUrl}/auth/${path}`, { headers, redirect: 'manual' });

  const cookiesOf = (res: Response) =>
    Object.fromEntries(
      res.headers.getSetCookie().map((c) => {
        const [pair] = c.split(';');
        const i = pair.indexOf('=');
        return [pair.slice(0, i), decodeURIComponent(pair.slice(i + 1))];
      }),
    );

  /** Runs login + callback for a fixture person, returns the response of the callback. */
  async function loginFlow(person: PersonKey, returnTo?: string) {
    const login = await get(`login${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`);
    const state = cookiesOf(login)[LOGIN_COOKIE];
    oidc.next = { claims: { sub: person, name: person, email: null, picture: null, idToken: 'id-token' } };
    return get(`callback?code=abc&state=${state}`, { cookie: `${LOGIN_COOKIE}=${state}` });
  }

  it('login redirects to the identity server and binds the state to the browser', async () => {
    const res = await get('login?returnTo=%2Fme%2Fmappen');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toMatch(/^http:\/\/idp\.test\/authorize/);
    const cookie = res.headers.getSetCookie().find((c) => c.startsWith(LOGIN_COOKIE));
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
  });

  it('rejects absolute returnTo URLs (open redirect)', async () => {
    const res = await get('login?returnTo=https%3A%2F%2Fevil.example');
    expect(res.status).toBe(400);
    expect((await get('login?returnTo=%2F%2Fevil.example')).status).toBe(400);
  });

  it('callback creates a session with httpOnly cookie and readable CSRF cookie, then redirects', async () => {
    const res = await loginFlow('musician', '/me/mappen');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('http://localhost:4200/me/mappen');
    const setCookies = res.headers.getSetCookie();
    const session = setCookies.find((c) => c.startsWith(`${SESSION_COOKIE}=`));
    const csrf = setCookies.find((c) => c.startsWith(`${CSRF_COOKIE}=`));
    expect(session).toMatch(/HttpOnly/i);
    expect(session).toMatch(/Secure/i);
    expect(session).toMatch(/SameSite=Lax/i);
    expect(csrf).not.toMatch(/HttpOnly/i);
    expect(users.calls.at(-1)).toMatchObject({ sub: 'musician' });
  });

  it('defaults to /me after login (A-3)', async () => {
    expect((await loginFlow('musician')).headers.get('location')).toBe('http://localhost:4200/me');
  });

  it('sends blocked accounts to /blocked without session (A-5)', async () => {
    const res = await loginFlow('blocked');
    expect(res.headers.get('location')).toBe('http://localhost:4200/blocked');
    expect(cookiesOf(res)[SESSION_COOKIE]).toBeFalsy();
  });

  it.each([
    ['without the browser cookie', (state: string) => [`callback?code=abc&state=${state}`, {}] as const],
    ['with a foreign state', (state: string) => [`callback?code=abc&state=${state}`, { cookie: `${LOGIN_COOKIE}=other` }] as const],
  ])('rejects the callback %s (login CSRF)', async (_, build) => {
    const login = await get('login');
    const state = cookiesOf(login)[LOGIN_COOKIE];
    const [path, headers] = build(state);
    const res = await get(path, headers);
    expect(res.headers.get('location')).toBe('http://localhost:4200/login?error=state-mismatch');
  });

  it('accepts a state only once', async () => {
    const login = await get('login');
    const state = cookiesOf(login)[LOGIN_COOKIE];
    oidc.next = { claims: { sub: 'musician', name: 'm', email: null, picture: null, idToken: null } };
    const headers = { cookie: `${LOGIN_COOKIE}=${state}` };
    expect((await get(`callback?code=abc&state=${state}`, headers)).headers.get('location')).toBe('http://localhost:4200/me');
    expect((await get(`callback?code=abc&state=${state}`, headers)).headers.get('location')).toContain('state-mismatch');
  });

  it('maps identity-server errors and failed token exchange to /login?error=…', async () => {
    expect((await get('callback?error=access_denied')).headers.get('location')).toContain('error=idp-error');
    const login = await get('login');
    const state = cookiesOf(login)[LOGIN_COOKIE];
    oidc.next = { error: new Error('invalid_grant') };
    const res = await get(`callback?code=abc&state=${state}`, { cookie: `${LOGIN_COOKIE}=${state}` });
    expect(res.headers.get('location')).toBe('http://localhost:4200/login?error=login-failed');
  });

  it('session reports anonymous visitors', async () => {
    const res = await get('session');
    expect(await res.json()).toEqual({ authenticated: false });
  });

  it('session returns user and effective permissions', async () => {
    const res = await get('session', await t.loginAs('youthAdminRole'));
    const body = sessionResponseSchema.parse(await res.json());
    if (!body.authenticated) throw new Error('expected authenticated');
    expect(body.user.name).toBe('admin-role');
    expect(body.permissions.club).toContain('user.edit');
    expect(body.permissions.memberships).toEqual([
      { ensemble: { id: ENS.youth, name: 'Jugendorchester' }, role: { id: roleIdOf('admin'), name: 'admin' } },
    ]);
    expect(body.permissions.ensembles.map((e) => e.ensemble.name)).toEqual(['Jugendorchester']);
  });

  it('session answers 403 account-blocked for a blocked account', async () => {
    const res = await get('session', await t.loginAs('blocked'));
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: 'account-blocked' });
  });

  it('logout needs the CSRF token and ends the session', async () => {
    const headers = await t.loginAs('musician');
    const withoutToken = await fetch(`${t.baseUrl}/auth/logout`, { method: 'POST', headers: { cookie: headers.cookie } });
    expect(withoutToken.status).toBe(403);

    const res = await fetch(`${t.baseUrl}/auth/logout`, { method: 'POST', headers });
    expect(res.status).toBe(204);
    expect(cookiesOf(res)[SESSION_COOKIE]).toBe('');
    expect(await (await get('session', headers)).json()).toEqual({ authenticated: false });
    expect(headers[CSRF_HEADER]).toBeTruthy();
  });

  it('login page returns branding and the legal links (S-7)', async () => {
    expect(await (await get('login-page')).json()).toEqual({
      clubName: 'Musikzug Test',
      logoUrl: '/internal/v1/auth/branding/logo',
      loginBanner: 'Willkommen',
      imprint: { kind: 'external', href: 'https://example.org/impressum' },
      privacy: { kind: 'internal', href: '/datenschutz' },
      autoRedirect: false,
    });
  });

  it('serves the logo publicly', async () => {
    const res = await get('branding/logo');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    // an SVG logo opened directly must not run scripts (S-4)
    expect(res.headers.get('content-security-policy')).toContain('sandbox');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(await res.text()).toBe('png:branding/logo.png');
  });
});
