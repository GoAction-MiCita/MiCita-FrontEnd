import { computed, inject, Injectable, signal } from '@angular/core';
import { AuthSession } from '@core/auth/auth-session';
import { API_ERROR_KIND, ApiError, isApiError } from '@core/http/api-error.model';
import { firstValueFrom } from 'rxjs';
import {
  EMPLOYEE_FORM_MESSAGES,
  EmployeeFormFailure,
  toEmployeeFormFailure,
} from '../models/employee-form-failure';
import { Employee, NewEmployee } from '../models/employee.model';
import { EmployeesApi } from './employees-api';

/** `stale`: the panel was closed or reopened before the answer arrived. */
export type LoadEmployeeResult = 'loaded' | 'not-found' | 'failed' | 'stale';
export type SaveEmployeeResult = 'saved' | 'not-found' | 'failed';

interface EditEmployeeState {
  readonly loading: boolean;
  readonly employee: Employee | null;
  readonly pending: boolean;
  readonly failure: EmployeeFormFailure | null;
}

const IDLE: EditEmployeeState = { loading: false, employee: null, pending: false, failure: null };

const UNKNOWN_ERROR: ApiError = {
  kind: API_ERROR_KIND.unknown,
  status: 0,
  message: null,
  fieldErrors: {},
};

/** State of the "Editar empleado" panel (HU-18). Provided by EmployeesPage. */
@Injectable()
export class EditEmployeeStore {
  private readonly api = inject(EmployeesApi);
  private readonly session = inject(AuthSession);
  private readonly state = signal<EditEmployeeState>(IDLE);
  private request = 0;

  readonly loading = computed(() => this.state().loading);
  readonly employee = computed(() => this.state().employee);
  readonly pending = computed(() => this.state().pending);
  readonly failure = computed(() => this.state().failure);

  /** Fetches the current data of the employee (not the possibly outdated row of the list). */
  async load(id: string): Promise<LoadEmployeeResult> {
    const request = ++this.request;
    this.state.set({ ...IDLE, loading: true });
    try {
      const employee = await firstValueFrom(this.api.get(id));
      if (request !== this.request) {
        return 'stale';
      }
      this.state.set({ ...IDLE, employee });
      return 'loaded';
    } catch (error: unknown) {
      if (request !== this.request) {
        return 'stale';
      }
      return this.fail(error, EMPLOYEE_FORM_MESSAGES.loadTitle, { ...IDLE });
    }
  }

  /** Sends the form; its `serviceIds` replace the services of the employee. */
  async save(changes: NewEmployee): Promise<SaveEmployeeResult> {
    const { employee, pending } = this.state();
    if (!employee || pending) {
      return 'failed';
    }
    this.state.set({ ...IDLE, employee, pending: true });
    try {
      await firstValueFrom(this.api.update(employee.id, changes));
      this.state.set({ ...IDLE, employee });
      return 'saved';
    } catch (error: unknown) {
      return this.fail(error, EMPLOYEE_FORM_MESSAGES.updateTitle, { ...IDLE, employee }, changes);
    }
  }

  /** Forgets the employee and ignores any answer still in flight. */
  reset(): void {
    this.request++;
    this.state.set(IDLE);
  }

  /** A 404 is left to the page; a 401 that survived the token refresh ends the session. */
  private async fail(
    error: unknown,
    title: string,
    next: EditEmployeeState,
    sent?: NewEmployee,
  ): Promise<'not-found' | 'failed'> {
    const apiError = isApiError(error) ? error : UNKNOWN_ERROR;
    if (apiError.kind === API_ERROR_KIND.notFound) {
      this.state.set(next);
      return 'not-found';
    }
    if (apiError.kind === API_ERROR_KIND.unauthorized) {
      this.state.set(next);
      await this.session.expire();
      return 'failed';
    }
    this.state.set({
      ...next,
      // The body carries the services without duplicates; serviceIds[i] indexes that list.
      failure: toEmployeeFormFailure(apiError, sent ? [...new Set(sent.serviceIds)] : [], title),
    });
    return 'failed';
  }
}
