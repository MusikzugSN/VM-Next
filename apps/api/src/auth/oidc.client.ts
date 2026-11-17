import { Inject, Injectable, Logger } from '@nestjs/common';
import { API_PREFIX } from '@vm-web/shared';
import * as oidc from 'openid-client';
import { AppConfig } from '../config/app-config.service';

export interface LoginRequest {
  url: string;
  state: string;
  nonce: string;
  codeVerifier: string;
}

/** Claims VM-Web uses from the identity server (A-4). */
export interface IdentityClaims {
  sub: string;
  name: string | null;
  email: string | null;
  picture: string | null;
  idToken: string | null;
}

export const OIDC_CLIENT = Symbol('OidcClient');

/** Abstraction over the OIDC library so the login logic can be tested without an identity server. */
export interface IOidcClient {
  createLoginRequest(): Promise<LoginRequest>;
  /** Exchanges the code (PKCE), validates state, nonce and ID token, returns the claims. */
  completeLogin(callbackQuery: string, checks: { state: string; nonce: string; codeVerifier: string }): Promise<IdentityClaims>;
}

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** Authorization Code flow with PKCE against the configured issuer (A-1), using `openid-client`. */
@Injectable()
export class OpenIdClient implements IOidcClient {
  private readonly logger = new Logger('OIDC');
  private configuration?: Promise<oidc.Configuration>;

  constructor(@Inject(AppConfig) private readonly config: AppConfig) {}

  get redirectUri(): string {
    return new URL(`${API_PREFIX}/auth/callback`, this.config.get('PUBLIC_BASE_URL')).toString();
  }

  async createLoginRequest(): Promise<LoginRequest> {
    const configuration = await this.discover();
    const codeVerifier = oidc.randomPKCECodeVerifier();
    const state = oidc.randomState();
    const nonce = oidc.randomNonce();
    const url = oidc.buildAuthorizationUrl(configuration, {
      redirect_uri: this.redirectUri,
      scope: this.config.get('OIDC_SCOPES'),
      code_challenge: await oidc.calculatePKCECodeChallenge(codeVerifier),
      code_challenge_method: 'S256',
      state,
      nonce,
    });
    return { url: url.toString(), state, nonce, codeVerifier };
  }

  async completeLogin(
    callbackQuery: string,
    checks: { state: string; nonce: string; codeVerifier: string },
  ): Promise<IdentityClaims> {
    const configuration = await this.discover();
    const currentUrl = new URL(this.redirectUri);
    currentUrl.search = callbackQuery;
    const tokens = await oidc.authorizationCodeGrant(configuration, currentUrl, {
      pkceCodeVerifier: checks.codeVerifier,
      expectedState: checks.state,
      expectedNonce: checks.nonce,
      idTokenExpected: true,
    });
    const claims = tokens.claims();
    if (!claims) throw new Error('ID token missing');

    let name = text(claims['name']) ?? text(claims['preferred_username']);
    let email = text(claims['email']);
    let picture = text(claims['picture']);
    if (!name || !email) {
      // some identity servers only put profile data into the userinfo response
      const info = await oidc.fetchUserInfo(configuration, tokens.access_token, claims.sub);
      name ??= text(info.name) ?? text(info.preferred_username);
      email ??= text(info.email);
      picture ??= text(info.picture);
    }
    return { sub: claims.sub, name, email, picture, idToken: tokens.id_token ?? null };
  }

  /** Discovery is cached; a failed discovery is retried on the next login. */
  private discover(): Promise<oidc.Configuration> {
    this.configuration ??= this.runDiscovery().catch((error: unknown) => {
      this.configuration = undefined;
      throw error;
    });
    return this.configuration;
  }

  private async runDiscovery(): Promise<oidc.Configuration> {
    const issuer = new URL(this.config.get('OIDC_ISSUER_URL'));
    const secret = this.config.get('OIDC_CLIENT_SECRET');
    const insecure = issuer.protocol === 'http:';
    if (insecure && this.config.isProduction) throw new Error('OIDC_ISSUER_URL must use https in production');
    const configuration = await oidc.discovery(
      issuer,
      this.config.get('OIDC_CLIENT_ID'),
      secret ? { client_secret: secret } : undefined,
      secret ? oidc.ClientSecretPost(secret) : oidc.None(),
      insecure ? { execute: [oidc.allowInsecureRequests] } : undefined,
    );
    this.logger.log(`Discovered ${configuration.serverMetadata().issuer}`);
    return configuration;
  }
}
