import { computed, inject, Injectable, signal } from '@angular/core';
import { API_ERROR_KIND, ApiError, isApiError } from '@core/http/api-error.model';
import { firstValueFrom } from 'rxjs';
import { RegisterFailure, toRegisterFailure } from '../models/register-failure';
import { NewUser, User } from '../models/user.model';
import { AuthApi } from './auth-api';

interface RegisterState {
  readonly pending: boolean;
  readonly user: User | null;
  readonly failure: RegisterFailure | null;
}

const UNKNOWN_ERROR: ApiError = {
  kind: API_ERROR_KIND.unknown,
  status: 0,
  message: null,
  fieldErrors: {},
};

/** State of the registration flow. Provided by RegisterPage. */
@Injectable()
export class RegisterStore {
  private readonly api = inject(AuthApi);
  private readonly state = signal<RegisterState>({ pending: false, user: null, failure: null });

  readonly pending = computed(() => this.state().pending);
  readonly user = computed(() => this.state().user);
  readonly failure = computed(() => this.state().failure);

  /** Resolves `true` when the account was created; otherwise `failure()` explains why. */
  async register(newUser: NewUser): Promise<boolean> {
    if (this.state().pending) {
      return false;
    }
    this.state.set({ pending: true, user: null, failure: null });
    try {
      const user = await firstValueFrom(this.api.register(newUser));
      this.state.set({ pending: false, user, failure: null });
      return true;
    } catch (error: unknown) {
      const failure = toRegisterFailure(isApiError(error) ? error : UNKNOWN_ERROR);
      this.state.set({ pending: false, user: null, failure });
      return false;
    }
  }
}
