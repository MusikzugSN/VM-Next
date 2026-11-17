import { Controller, Get, HttpCode, Inject, Post, Query, Req, Res, StreamableFile } from '@nestjs/common';
import {
  API_ROUTES,
  loginPageResponseSchema,
  loginQuerySchema,
  sessionResponseSchema,
  type LoginQuery,
  type LoginPageResponse,
  type SessionResponse,
} from '@vm-web/shared';
import type { Response } from 'express';
import {
  clearLoginCookie,
  clearSessionCookies,
  LOGIN_COOKIE,
  readCookie,
  setLoginCookie,
  setSessionCookies,
} from '../access/cookies';
import { Public, type AuthenticatedRequest } from '../access/decorators';
import { SessionStore, type SessionData } from '../access/session.store';
import { ProblemException } from '../common/problem-details/problem.exception';
import { ResponseSchema } from '../common/validation/zod-response.interceptor';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import { ClubSettingsRepository } from '../settings/club-settings.repository';
import { FILE_STORAGE, type IFileStorage } from '../storage/file-storage';
import { AuthService } from './auth.service';

const R = API_ROUTES.auth;

@Controller(R.base)
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(SessionStore) private readonly sessions: SessionStore,
    @Inject(ClubSettingsRepository) private readonly settings: ClubSettingsRepository,
    @Inject(FILE_STORAGE) private readonly storage: IFileStorage,
  ) {}

  /** A-1, A-2: redirect to the identity server. */
  @Public()
  @Get(R.login.path)
  async login(
    @Query(new ZodValidationPipe(loginQuerySchema)) query: LoginQuery,
    @Res() res: Response,
  ): Promise<void> {
    const { redirect, state } = await this.auth.startLogin(query.returnTo);
    setLoginCookie(res, state);
    res.redirect(302, redirect);
  }

  /** A-1, A-3, A-4, A-5, S-5: OIDC redirect target. */
  @Public()
  @Get(R.callback.path)
  async callback(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
    const queryString = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
    const result = await this.auth.finishLogin(req.query, queryString, readCookie(req, LOGIN_COOKIE));
    clearLoginCookie(res);
    if (result.kind === 'success') {
      // a previous session in this browser ends; the new one gets a fresh id (no fixation)
      if (req.vmweb) await this.auth.logout(req.vmweb.sessionId);
      setSessionCookies(res, result.sessionId, result.csrfToken, this.sessions.absoluteTtlMs);
    }
    res.redirect(302, result.redirect);
  }

  /** A-6 (RP logout) follows later; this ends the VM-Web session. */
  @Post(R.logout.path)
  @HttpCode(204)
  async logout(@Req() req: AuthenticatedRequest, @Res({ passthrough: true }) res: Response): Promise<void> {
    if (req.vmweb) await this.auth.logout(req.vmweb.sessionId);
    clearSessionCookies(res);
  }

  @Public({ reportBlocked: true })
  @Get(R.session.path)
  @ResponseSchema(sessionResponseSchema)
  session(@Req() req: AuthenticatedRequest, @Res({ passthrough: true }) res: Response): SessionResponse {
    if (req.vmweb) {
      // re-issue the readable CSRF cookie in case the browser lost it
      setSessionCookies(res, req.vmweb.sessionId, req.vmweb.session.csrfToken, this.remainingMs(req.vmweb.session));
    }
    return this.auth.sessionResponse(req.vmweb);
  }

  @Public()
  @Get(R.loginPage.path)
  @ResponseSchema(loginPageResponseSchema)
  loginPage(): Promise<LoginPageResponse> {
    return this.auth.loginPage();
  }

  @Public()
  @Get(R.logo.path)
  async logo(@Res({ passthrough: true }) res: Response): Promise<StreamableFile> {
    const settings = await this.settings.get();
    if (!settings.logoFileKey || !settings.logoMime) throw ProblemException.notFound();
    const stream = await this.storage.read(settings.logoFileKey).catch(() => {
      throw ProblemException.notFound();
    });
    res.setHeader('Cache-Control', 'public, max-age=300');
    // an SVG logo opened directly must not run scripts on our origin
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return new StreamableFile(stream, { type: settings.logoMime, disposition: 'inline; filename="logo"' });
  }

  private remainingMs(session: SessionData): number {
    return Math.max(0, session.absoluteExpiresAt - Date.now());
  }
}
