import { computed, inject, Injectable, signal } from '@angular/core';
import { AuthSession } from '@core/auth/auth-session';
import { API_ERROR_KIND, ApiError, isApiError } from '@core/http/api-error.model';
import { firstValueFrom } from 'rxjs';
import { NewBusiness } from '../models/business.model';
import { OnboardingFailure, toOnboardingFailure } from '../models/onboarding-failure';
import { BusinessApi } from './business-api';

interface OnboardingState {
  readonly pending: boolean;
  readonly failure: OnboardingFailure | null;
}

const UNKNOWN_ERROR: ApiError = {
  kind: API_ERROR_KIND.unknown,
  status: 0,
  message: null,
  fieldErrors: {},
};

/** State of the "Registra tu negocio" dialog. Provided by DashboardPage. */
@Injectable()
export class OnboardingStore {
  private readonly api = inject(BusinessApi);
  private readonly session = inject(AuthSession);
  private readonly state = signal<OnboardingState>({ pending: false, failure: null });

  readonly pending = computed(() => this.state().pending);
  readonly failure = computed(() => this.state().failure);

  /**
   * Resolves `true` once the business exists and the session reflects it.
   * A 401 that survived the token refresh ends the session (back to login).
   */
  async createBusiness(business: NewBusiness): Promise<boolean> {
    if (this.state().pending) {
      return false;
    }
    this.state.set({ pending: true, failure: null });
    try {
      await firstValueFrom(this.api.createOnboarding(business));
      await this.session.markBusinessCreated();
      this.state.set({ pending: false, failure: null });
      return true;
    } catch (error: unknown) {
      const apiError = isApiError(error) ? error : UNKNOWN_ERROR;
      if (apiError.kind === API_ERROR_KIND.unauthorized) {
        this.state.set({ pending: false, failure: null });
        await this.session.expire();
        return false;
      }
      this.state.set({ pending: false, failure: toOnboardingFailure(apiError) });
      return false;
    }
  }
}
