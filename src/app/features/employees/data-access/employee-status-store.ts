import { inject, Injectable, signal } from '@angular/core';
import { AuthSession } from '@core/auth/auth-session';
import { API_ERROR_KIND, ApiError, isApiError } from '@core/http/api-error.model';
import { firstValueFrom } from 'rxjs';
import { toEmployeeStatusFailureMessage } from '../models/employee-status-messages';
import { EMPLOYEE_STATUS, Employee, EmployeeStatus } from '../models/employee.model';
import { EmployeesApi } from './employees-api';

export type EmployeeStatusChange =
  | { readonly kind: 'changed'; readonly status: EmployeeStatus }
  /** `gone`: 404, the employee no longer exists (deleted meanwhile or from another business). */
  | { readonly kind: 'failed'; readonly message: string; readonly gone: boolean }
  /** Already in flight for this employee, or the session ended (401). */
  | { readonly kind: 'ignored' };

const UNKNOWN_ERROR: ApiError = {
  kind: API_ERROR_KIND.unknown,
  status: 0,
  message: null,
  fieldErrors: {},
};

/** HU-20 "Activar/Desactivar" from the list: one request at a time per employee. */
@Injectable()
export class EmployeeStatusStore {
  private readonly api = inject(EmployeesApi);
  private readonly session = inject(AuthSession);
  private readonly pending = signal<ReadonlySet<string>>(new Set());

  /** Ids of the employees whose change is in flight (their toggle is aria-disabled). */
  readonly pendingIds = this.pending.asReadonly();

  /**
   * The new status is only known (and shown) once the backend answers. The toggle stays focusable
   * while busy (aria-disabled), so a second click is ignored here.
   */
  async toggle(employee: Employee): Promise<EmployeeStatusChange> {
    if (this.pending().has(employee.id)) {
      return { kind: 'ignored' };
    }
    const target =
      employee.status === EMPLOYEE_STATUS.active
        ? EMPLOYEE_STATUS.inactive
        : EMPLOYEE_STATUS.active;
    this.setPending(employee.id, true);
    try {
      const status = await firstValueFrom(this.api.changeStatus(employee.id, target));
      return { kind: 'changed', status };
    } catch (error: unknown) {
      const apiError = isApiError(error) ? error : UNKNOWN_ERROR;
      if (apiError.kind === API_ERROR_KIND.unauthorized) {
        // A 401 that survived the token refresh ends the session (back to login).
        await this.session.expire();
        return { kind: 'ignored' };
      }
      return {
        kind: 'failed',
        message: toEmployeeStatusFailureMessage(apiError),
        gone: apiError.kind === API_ERROR_KIND.notFound,
      };
    } finally {
      this.setPending(employee.id, false);
    }
  }

  private setPending(id: string, pending: boolean): void {
    this.pending.update((ids) => {
      const next = new Set(ids);
      if (pending) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }
}
