import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { API_ERROR_KIND, ApiError, isApiError } from '@core/http/api-error.model';
import {
  catchError,
  finalize,
  firstValueFrom,
  map,
  Observable,
  shareReplay,
  tap,
  throwError,
} from 'rxjs';
import { SessionApi } from './session-api';
import { Credentials, IssuedSession, SessionUser } from './session.model';
import { TokenStorage } from './token-storage';

interface SessionState {
  /** Kept in memory only, never persisted. */
  readonly accessToken: string | null;
  readonly user: SessionUser | null;
}

const NO_SESSION: SessionState = { accessToken: null, user: null };

const NO_REFRESH_TOKEN: ApiError = {
  kind: API_ERROR_KIND.unauthorized,
  status: 401,
  message: null,
  fieldErrors: {},
};

export const LOGIN_PATH = '/auth/login';

/** Single source of truth for the authenticated session. */
@Injectable({ providedIn: 'root' })
export class AuthSession {
  private readonly api = inject(SessionApi);
  private readonly storage = inject(TokenStorage);
  private readonly router = inject(Router);

  private readonly state = signal<SessionState>(NO_SESSION);
  private refreshInFlight: Observable<string> | null = null;

  readonly user = computed(() => this.state().user);
  readonly isAuthenticated = computed(() => this.state().accessToken !== null);

  /** Current access token for the auth interceptor (not reactive on purpose). */
  accessToken(): string | null {
    return this.state().accessToken;
  }

  login(credentials: Credentials, remember: boolean): Observable<SessionUser> {
    return this.api.login(credentials).pipe(
      tap((issued) => this.apply(issued, remember)),
      map((issued) => issued.user),
    );
  }

  /**
   * Gets a new access token with the stored refresh token. Concurrent callers share the same
   * request, so a burst of 401s triggers a single `POST /auth/refresh`.
   * A 401 from the backend means the refresh token is no longer valid: the session is cleared.
   */
  refresh(): Observable<string> {
    if (this.refreshInFlight) {
      return this.refreshInFlight;
    }
    const refreshToken = this.storage.readRefreshToken();
    if (!refreshToken) {
      return throwError(() => NO_REFRESH_TOKEN);
    }
    const remember = this.storage.isRemembered();
    this.refreshInFlight = this.api.refresh(refreshToken).pipe(
      tap((issued) => this.apply(issued, remember, refreshToken)),
      map((issued) => issued.accessToken),
      catchError((error: unknown) => {
        if (isApiError(error) && error.kind === API_ERROR_KIND.unauthorized) {
          this.clear();
        }
        return throwError(() => error);
      }),
      finalize(() => (this.refreshInFlight = null)),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.refreshInFlight;
  }

  /** Resolves `true` when there is a session, restoring it from the refresh token if needed. */
  async ensureSession(): Promise<boolean> {
    if (this.isAuthenticated()) {
      return true;
    }
    if (!this.storage.readRefreshToken()) {
      return false;
    }
    try {
      await firstValueFrom(this.refresh());
      return true;
    } catch {
      return false;
    }
  }

  /**
   * The user just created their business (HU-03). Tries to get a token with the updated
   * `hasBusiness` claim and, whatever the backend answers, reflects it in the local session so
   * the onboarding is not shown again.
   */
  async markBusinessCreated(): Promise<void> {
    try {
      await firstValueFrom(this.refresh());
    } catch {
      // Best effort: the next login or refresh will carry the claim anyway.
    }
    this.state.update((state) =>
      state.user ? { ...state, user: { ...state.user, hasBusiness: true } } : state,
    );
  }

  /** The session can no longer be renewed: forget it and go to the login. */
  async expire(): Promise<void> {
    this.clear();
    await this.router.navigate([LOGIN_PATH], { queryParams: { expired: true } });
  }

  /** Revokes the refresh token in the backend (best effort) and always clears the local session. */
  async logout(): Promise<void> {
    const refreshToken = this.storage.readRefreshToken();
    try {
      if (refreshToken) {
        await firstValueFrom(this.api.logout(refreshToken));
      }
    } catch {
      // The local session is cleared anyway; an unrevoked token expires on its own.
    } finally {
      this.clear();
      await this.router.navigate([LOGIN_PATH]);
    }
  }

  private apply(issued: IssuedSession, remember: boolean, previousRefreshToken?: string): void {
    this.state.set({ accessToken: issued.accessToken, user: issued.user });
    const refreshToken = issued.refreshToken ?? previousRefreshToken;
    if (refreshToken) {
      this.storage.writeRefreshToken(refreshToken, remember);
    }
  }

  private clear(): void {
    this.state.set(NO_SESSION);
    this.storage.clear();
  }
}
