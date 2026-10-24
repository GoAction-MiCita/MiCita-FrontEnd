import { computed, inject, Injectable, signal } from '@angular/core';
import { AuthSession } from '@core/auth/auth-session';
import { API_ERROR_KIND, ApiError, isApiError } from '@core/http/api-error.model';
import { firstValueFrom } from 'rxjs';
import { ServiceFormFailure, toServiceFormFailure } from '../models/service-form-failure';
import { NewService } from '../models/service.model';
import { ServicesApi } from './services-api';

interface CreateServiceState {
  readonly pending: boolean;
  readonly failure: ServiceFormFailure | null;
}

const IDLE: CreateServiceState = { pending: false, failure: null };

const UNKNOWN_ERROR: ApiError = {
  kind: API_ERROR_KIND.unknown,
  status: 0,
  message: null,
  fieldErrors: {},
};

/** State of the "Agregar servicio" panel (HU-09). Provided by ServicesPage. */
@Injectable()
export class CreateServiceStore {
  private readonly api = inject(ServicesApi);
  private readonly session = inject(AuthSession);
  private readonly state = signal<CreateServiceState>(IDLE);

  readonly pending = computed(() => this.state().pending);
  readonly failure = computed(() => this.state().failure);

  /**
   * Resolves `true` once the service exists.
   * A 401 that survived the token refresh ends the session (back to login).
   */
  async create(service: NewService): Promise<boolean> {
    if (this.state().pending) {
      return false;
    }
    this.state.set({ pending: true, failure: null });
    try {
      await firstValueFrom(this.api.create(service));
      this.state.set(IDLE);
      return true;
    } catch (error: unknown) {
      const apiError = isApiError(error) ? error : UNKNOWN_ERROR;
      if (apiError.kind === API_ERROR_KIND.unauthorized) {
        this.state.set(IDLE);
        await this.session.expire();
        return false;
      }
      this.state.set({
        pending: false,
        failure: toServiceFormFailure(apiError, undefined, service.employeeIds),
      });
      return false;
    }
  }

  /** Forgets the last failure so the panel opens clean. */
  reset(): void {
    this.state.set(IDLE);
  }
}
