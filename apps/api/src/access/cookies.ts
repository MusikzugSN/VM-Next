import { CSRF_COOKIE, SESSION_COOKIE } from '@vm-web/shared';
import type { CookieOptions, Request, Response } from 'express';

/** Short-lived cookie binding `auth/callback` to the browser that started `auth/login` (login CSRF). */
export const LOGIN_COOKIE = 'vmweb_login';

/** Minimal RFC 6265 cookie header parser (first value wins). */
export function parseCookies(header: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!header) return result;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const name = part.slice(0, eq).trim();
    if (!name || name in result) continue;
    let value = part.slice(eq + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    try {
      result[name] = decodeURIComponent(value);
    } catch {
      result[name] = value;
    }
  }
  return result;
}

export function readCookie(req: Request, name: string): string | undefined {
  return parseCookies(req.headers.cookie)[name];
}

const base: CookieOptions = { secure: true, sameSite: 'lax', path: '/' };

export function setSessionCookies(res: Response, sessionId: string, csrfToken: string, maxAgeMs: number): void {
  res.cookie(SESSION_COOKIE, sessionId, { ...base, httpOnly: true, maxAge: maxAgeMs });
  // readable by the frontend, sent back as X-XSRF-TOKEN (Angular default)
  res.cookie(CSRF_COOKIE, csrfToken, { ...base, httpOnly: false, maxAge: maxAgeMs });
}

export function clearSessionCookies(res: Response): void {
  res.clearCookie(SESSION_COOKIE, { ...base, httpOnly: true });
  res.clearCookie(CSRF_COOKIE, { ...base, httpOnly: false });
}

export function setLoginCookie(res: Response, state: string): void {
  res.cookie(LOGIN_COOKIE, state, { ...base, httpOnly: true, maxAge: 600_000 });
}

export function clearLoginCookie(res: Response): void {
  res.clearCookie(LOGIN_COOKIE, { ...base, httpOnly: true });
}
