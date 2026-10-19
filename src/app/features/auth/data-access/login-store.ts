import { computed, inject, Injectable, signal } from '@angular/core';
import { AuthSession } from '@core/auth/auth-session';
import { Credentials, SessionUser } from '@core/auth/session.model';
import { API_ERROR_KIND, ApiError, isApiError } from '@core/http/api-error.model';
import { firstValueFrom } from 'rxjs';
import { toLoginFailure } from '../models/login-failure';

interface LoginState {
  readonly pending: boolean;
  readonly failure: string | null;
}

const UNKNOWN_ERROR: ApiError = {
  kind: API_ERROR_KIND.unknown,
  status: 0,
  message: null,
  fieldErrors: {},
};

/** State of the login form. Provided by LoginPage. */
@Injectable()
export class LoginStore {
  private readonly session = inject(AuthSession);
  private readonly state = signal<LoginState>({ pending: false, failure: null });

  readonly pending = computed(() => this.state().pending);
  readonly failure = computed(() => this.state().failure);

  /** Resolves the user on success, or `null` with `failure()` set. */
  async login(credentials: Credentials, remember: boolean): Promise<SessionUser | null> {
    if (this.state().pending) {
      return null;
    }
    this.state.set({ pending: true, failure: null });
    try {
      const user = await firstValueFrom(this.session.login(credentials, remember));
      this.state.set({ pending: false, failure: null });
      return user;
    } catch (error: unknown) {
      const failure = toLoginFailure(isApiError(error) ? error : UNKNOWN_ERROR);
      this.state.set({ pending: false, failure });
      return null;
    }
  }
}
