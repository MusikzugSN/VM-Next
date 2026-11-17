import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { CACHE_SERVICE, type ICacheService } from '../cache/cache.service';
import { AppConfig } from '../config/app-config.service';

export interface SessionData {
  userId: string;
  csrfToken: string;
  createdAt: number;
  lastSeenAt: number;
  absoluteExpiresAt: number;
  /** Kept for RP-initiated logout later (A-6); never sent to the browser. */
  idToken: string | null;
}

/** Pre-login state between `auth/login` and `auth/callback`. */
export interface LoginState {
  codeVerifier: string;
  nonce: string;
  returnTo: string;
}

const DAY_MS = 86_400_000;
const LOGIN_TTL_SECONDS = 600;
/** Writes for sliding expiry at most once per minute. */
const TOUCH_INTERVAL_MS = 60_000;

const randomToken = () => randomBytes(32).toString('base64url');
/** The cache only sees hashes of session ids, so a dump of it cannot be replayed as cookies. */
const sessionKey = (id: string) => `session:${createHash('sha256').update(id).digest('base64url')}`;
const loginKey = (state: string) => `login:${createHash('sha256').update(state).digest('base64url')}`;

/** Server-side sessions (BFF): the browser only holds the random session id. */
@Injectable()
export class SessionStore {
  constructor(
    @Inject(CACHE_SERVICE) private readonly cache: ICacheService,
    @Inject(AppConfig) private readonly config: AppConfig,
  ) {}

  get idleTtlMs(): number {
    return this.config.get('SESSION_IDLE_TTL_DAYS') * DAY_MS;
  }

  get absoluteTtlMs(): number {
    return this.config.get('SESSION_ABSOLUTE_TTL_DAYS') * DAY_MS;
  }

  /** Creates a new session with a fresh id (no fixation) and CSRF token. */
  async create(userId: string, idToken: string | null, now = Date.now()): Promise<{ id: string; data: SessionData }> {
    const id = randomToken();
    const data: SessionData = {
      userId,
      csrfToken: randomToken(),
      createdAt: now,
      lastSeenAt: now,
      absoluteExpiresAt: now + this.absoluteTtlMs,
      idToken,
    };
    await this.write(id, data, now);
    return { id, data };
  }

  /** Returns the session if it exists and is within the absolute lifetime; slides the idle expiry. */
  async get(id: string, now = Date.now()): Promise<SessionData | undefined> {
    const data = await this.cache.get<SessionData>(sessionKey(id));
    if (!data) return undefined;
    if (data.absoluteExpiresAt <= now) {
      await this.destroy(id);
      return undefined;
    }
    if (now - data.lastSeenAt >= TOUCH_INTERVAL_MS) {
      data.lastSeenAt = now;
      await this.write(id, data, now);
    }
    return data;
  }

  async destroy(id: string): Promise<void> {
    await this.cache.delete(sessionKey(id));
  }

  async saveLoginState(state: string, value: LoginState): Promise<void> {
    await this.cache.set(loginKey(state), value, LOGIN_TTL_SECONDS);
  }

  /** One-time: the state is deleted when read. */
  async takeLoginState(state: string): Promise<LoginState | undefined> {
    const value = await this.cache.get<LoginState>(loginKey(state));
    if (value) await this.cache.delete(loginKey(state));
    return value;
  }

  private async write(id: string, data: SessionData, now: number): Promise<void> {
    const ttlMs = Math.min(this.idleTtlMs, data.absoluteExpiresAt - now);
    await this.cache.set(sessionKey(id), data, Math.max(1, Math.ceil(ttlMs / 1000)));
  }
}
