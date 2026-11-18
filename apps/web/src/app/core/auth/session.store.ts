import { DOCUMENT } from '@angular/common';
import { computed, inject, Injectable, signal } from '@angular/core';
import {
  APP_ROUTES,
  apiUrl,
  sessionResponseSchema,
  type Permission,
  type SessionResponse,
} from '@vm-web/shared';
import { firstValueFrom } from 'rxjs';

import { ApiClient } from '../api/api-client';
import { hasPermission, isMember, type Access } from './permissions';

/**
 * The signed-in person and their effective permissions (`GET auth/session`).
 * Loaded once on the first guarded navigation; reloaded after changes that affect it.
 */
@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly api = inject(ApiClient);
  private readonly document = inject(DOCUMENT);

  private readonly state = signal<SessionResponse | null>(null);
  private pending: Promise<SessionResponse> | undefined;

  readonly loaded = computed(() => this.state() !== null);
  readonly isAuthenticated = computed(() => this.state()?.authenticated === true);
  readonly user = computed(() => {
    const state = this.state();
    return state?.authenticated ? state.user : null;
  });
  readonly access = computed<Access | null>(() => {
    const state = this.state();
    return state?.authenticated ? { isAdmin: state.user.isAdmin, permissions: state.permissions } : null;
  });
  readonly memberships = computed(() => this.access()?.permissions.memberships ?? []);
  readonly isMember = computed(() => {
    const access = this.access();
    return access !== null && isMember(access);
  });

  /** Loads the session once; concurrent callers share the request. Rejects on network errors. */
  ensureLoaded(): Promise<SessionResponse> {
    const state = this.state();
    if (state) return Promise.resolve(state);
    this.pending ??= firstValueFrom(this.api.get(apiUrl('auth', 'session'), sessionResponseSchema)).then(
      (session) => {
        this.state.set(session);
        this.pending = undefined;
        return session;
      },
      (error: unknown) => {
        this.pending = undefined;
        throw error;
      },
    );
    return this.pending;
  }

  /** Fetches the session again, e.g. after the own roles changed. */
  reload(): Promise<SessionResponse> {
    this.state.set(null);
    return this.ensureLoaded();
  }

  can(permission: Permission, ensembleId?: string): boolean {
    const access = this.access();
    return access !== null && hasPermission(access, permission, ensembleId);
  }

  /**
   * Ends the session (A-6: only in VM-Web, not at the identity server) and reloads the app on
   * the login page, so no data of the previous person stays in memory.
   */
  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.api.postVoid(apiUrl('auth', 'logout')));
    } finally {
      this.document.location.assign(APP_ROUTES.login);
    }
  }
}
