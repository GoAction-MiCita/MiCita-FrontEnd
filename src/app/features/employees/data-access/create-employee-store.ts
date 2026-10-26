import { computed, inject, Injectable, signal } from '@angular/core';
import { AuthSession } from '@core/auth/auth-session';
import { API_ERROR_KIND, ApiError, isApiError } from '@core/http/api-error.model';
import { firstValueFrom } from 'rxjs';
import { EmployeeFormFailure, toEmployeeFormFailure } from '../models/employee-form-failure';
import { NewEmployee } from '../models/employee.model';
import { EmployeesApi } from './employees-api';

interface CreateEmployeeState {
  readonly pending: boolean;
  readonly failure: EmployeeFormFailure | null;
}

const IDLE: CreateEmployeeState = { pending: false, failure: null };

const UNKNOWN_ERROR: ApiError = {
  kind: API_ERROR_KIND.unknown,
  status: 0,
  message: null,
  fieldErrors: {},
};

/** State of the "Agregar empleado" panel (HU-17). Provided by EmployeesPage. */
@Injectable()
export class CreateEmployeeStore {
  private readonly api = inject(EmployeesApi);
  private readonly session = inject(AuthSession);
  private readonly state = signal<CreateEmployeeState>(IDLE);

  readonly pending = computed(() => this.state().pending);
  readonly failure = computed(() => this.state().failure);

  /**
   * Resolves `true` once the employee exists.
   * A 401 that survived the token refresh ends the session (back to login).
   */
  async create(employee: NewEmployee): Promise<boolean> {
    if (this.state().pending) {
      return false;
    }
    this.state.set({ pending: true, failure: null });
    try {
      await firstValueFrom(this.api.create(employee));
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
        failure: toEmployeeFormFailure(apiError, employee.serviceIds),
      });
      return false;
    }
  }

  /** Forgets the last failure so the panel opens clean. */
  reset(): void {
    this.state.set(IDLE);
  }
}
