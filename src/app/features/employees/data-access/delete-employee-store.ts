import { computed, inject, Injectable, signal } from '@angular/core';
import { AuthSession } from '@core/auth/auth-session';
import { API_ERROR_KIND, ApiError, isApiError } from '@core/http/api-error.model';
import { firstValueFrom } from 'rxjs';
import { DeleteEmployeeFailure, toDeleteEmployeeFailure } from '../models/delete-employee-failure';
import { Employee } from '../models/employee.model';
import { EmployeesApi } from './employees-api';

export type DeleteEmployeeResult = 'deleted' | 'not-found' | 'failed';

interface DeleteEmployeeState {
  /** Employee waiting for confirmation; `null` while the dialog is closed. */
  readonly employee: Employee | null;
  readonly pending: boolean;
  readonly failure: DeleteEmployeeFailure | null;
}

const CLOSED: DeleteEmployeeState = { employee: null, pending: false, failure: null };

const UNKNOWN_ERROR: ApiError = {
  kind: API_ERROR_KIND.unknown,
  status: 0,
  message: null,
  fieldErrors: {},
};

/** State of the "Eliminar empleado" confirmation (HU-21). Provided by EmployeesPage. */
@Injectable()
export class DeleteEmployeeStore {
  private readonly api = inject(EmployeesApi);
  private readonly session = inject(AuthSession);
  private readonly state = signal<DeleteEmployeeState>(CLOSED);

  readonly employee = computed(() => this.state().employee);
  readonly pending = computed(() => this.state().pending);
  readonly failure = computed(() => this.state().failure);

  /** Asks for confirmation; nothing is sent until `confirm()`. */
  open(employee: Employee): void {
    this.state.set({ ...CLOSED, employee });
  }

  close(): void {
    if (!this.state().pending) {
      this.state.set(CLOSED);
    }
  }

  /** A 404 and a success close the dialog; other failures stay in it. */
  async confirm(): Promise<DeleteEmployeeResult> {
    const { employee, pending, failure } = this.state();
    if (!employee || pending || failure?.blocked) {
      return 'failed';
    }
    this.state.set({ employee, pending: true, failure: null });
    try {
      await firstValueFrom(this.api.remove(employee.id));
      this.state.set(CLOSED);
      return 'deleted';
    } catch (error: unknown) {
      const apiError = isApiError(error) ? error : UNKNOWN_ERROR;
      if (apiError.kind === API_ERROR_KIND.notFound) {
        this.state.set(CLOSED);
        return 'not-found';
      }
      if (apiError.kind === API_ERROR_KIND.unauthorized) {
        this.state.set(CLOSED);
        // A 401 that survived the token refresh ends the session (back to login).
        await this.session.expire();
        return 'failed';
      }
      this.state.set({
        employee,
        pending: false,
        failure: toDeleteEmployeeFailure(apiError, employee),
      });
      return 'failed';
    }
  }
}
