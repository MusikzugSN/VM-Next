import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  API_PREFIX,
  APP_QUERY,
  APP_ROUTES,
  appPath,
  DEFAULT_APP_PATH,
  callbackQuerySchema,
  permissionScope,
  type LoginErrorCode,
  type LoginPageResponse,
  type SessionResponse,
} from '@vm-web/shared';
import type { RequestAuth } from '../access/decorators';
import { SessionStore } from '../access/session.store';
import { httpUrlOrNull } from '../common/url';
import { AppConfig } from '../config/app-config.service';
import { ClubSettingsRepository } from '../settings/club-settings.repository';
import { OIDC_CLIENT, type IOidcClient } from './oidc.client';
import { USERS_REPOSITORY, type IUsersRepository } from './users.repository';


export type CallbackResult =
  | { kind: 'success'; redirect: string; sessionId: string; csrfToken: string }
  | { kind: 'failure'; redirect: string };

/** BFF login (A-1..A-5, S-5): tokens stay on the server, the browser only gets a session cookie. */
@Injectable()
export class AuthService {
  private readonly logger = new Logger('Auth');

  constructor(
    @Inject(OIDC_CLIENT) private readonly oidc: IOidcClient,
    @Inject(USERS_REPOSITORY) private readonly users: IUsersRepository,
    @Inject(SessionStore) private readonly sessions: SessionStore,
    @Inject(ClubSettingsRepository) private readonly settings: ClubSettingsRepository,
    @Inject(AppConfig) private readonly config: AppConfig,
  ) {}

  /** Absolute URL of a frontend path on the public address. */
  appUrl(path: string): string {
    return new URL(path, this.config.get('PUBLIC_BASE_URL')).toString();
  }

  async startLogin(returnTo: string | undefined): Promise<{ redirect: string; state: string }> {
    const request = await this.oidc.createLoginRequest();
    await this.sessions.saveLoginState(request.state, {
      codeVerifier: request.codeVerifier,
      nonce: request.nonce,
      returnTo: returnTo ?? DEFAULT_APP_PATH,
    });
    return { redirect: request.url, state: request.state };
  }

  /**
   * Handles the identity server's redirect. Never throws: every outcome is a redirect,
   * failures go to `/login?error=<code>`, blocked accounts to `/blocked` (A-5).
   */
  async finishLogin(rawQuery: Record<string, unknown>, queryString: string, browserState: string | undefined): Promise<CallbackResult> {
    const fail = (code: LoginErrorCode): CallbackResult => ({ kind: 'failure', redirect: this.appUrl(appPath(APP_ROUTES.login, {}, { [APP_QUERY.error]: code })) });

    const query = callbackQuerySchema.safeParse(rawQuery);
    if (!query.success) return fail('login-failed');
    if (query.data.error) {
      this.logger.warn(`Identity server returned "${query.data.error}"`);
      return fail('idp-error');
    }
    const { state, code } = query.data;
    if (!state || !code || state !== browserState) return fail('state-mismatch');
    const loginState = await this.sessions.takeLoginState(state);
    if (!loginState) return fail('state-mismatch');

    let claims;
    try {
      claims = await this.oidc.completeLogin(queryString, {
        state,
        nonce: loginState.nonce,
        codeVerifier: loginState.codeVerifier,
      });
    } catch (error) {
      this.logger.warn(`Login failed: ${error instanceof Error ? error.message : String(error)}`);
      return fail('login-failed');
    }

    const user = await this.users.upsertOnLogin(claims, new Date());
    if (user.created) this.logger.log(`Account created for ${user.id}${user.isAdmin ? ' (first person, admin)' : ''}`);
    if (user.status === 'blocked') return { kind: 'failure', redirect: this.appUrl(APP_ROUTES.blocked) };

    const session = await this.sessions.create(user.id, claims.idToken);
    return {
      kind: 'success',
      redirect: this.appUrl(loginState.returnTo),
      sessionId: session.id,
      csrfToken: session.data.csrfToken,
    };
  }

  async logout(sessionId: string): Promise<void> {
    await this.sessions.destroy(sessionId);
  }

  sessionResponse(auth: RequestAuth | undefined): SessionResponse {
    if (!auth) return { authenticated: false };
    const { user, access } = auth;
    const ref = (id: string) => ({ id, name: access.ensembleName(id) ?? '' });
    return {
      authenticated: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        pictureUrl: httpUrlOrNull(user.pictureUrl),
        isAdmin: user.isAdmin,
      },
      permissions: {
        club: [...access.club].filter((p) => permissionScope(p) === 'club').sort(),
        anyEnsemble: [...access.anyEnsemble].sort(),
        memberships: access.memberships.map((m) => ({
          ensemble: { id: m.ensembleId, name: m.ensembleName },
          role: { id: m.roleId, name: m.roleName },
        })),
        ensembles: [...access.byEnsemble].map(([id, permissions]) => ({ ensemble: ref(id), permissions: [...permissions].sort() })),
      },
    };
  }

  async loginPage(): Promise<LoginPageResponse> {
    const s = await this.settings.get();
    return {
      clubName: s.clubName,
      logoUrl: s.logoFileKey ? `${API_PREFIX}/auth/branding/logo` : null,
      loginBanner: s.loginBanner,
      imprintUrl: httpUrlOrNull(s.imprintUrl),
      privacyUrl: httpUrlOrNull(s.privacyUrl),
      autoRedirect: s.loginAutoRedirect,
    };
  }
}
