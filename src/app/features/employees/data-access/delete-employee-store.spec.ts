import { TestBed } from '@angular/core/testing';
import { AuthSession } from '@core/auth/auth-session';
import { ApiError } from '@core/http/api-error.model';
import { Observable, of, Subject, throwError } from 'rxjs';
import {
  DELETE_EMPLOYEE_MESSAGES,
  futureAppointmentsMessage,
} from '../models/delete-employee-failure';
import { Employee } from '../models/employee.model';
import { DeleteEmployeeStore } from './delete-employee-store';
import { EmployeesApi } from './employees-api';

const employee: Employee = {
  id: 'e1',
  firstName: 'Ana',
  lastName: 'López',
  fullName: 'Ana López',
  phone: null,
  email: null,
  status: 'ACTIVE',
  services: [],
};

function setup(remove: () => Observable<void> = () => of(undefined)) {
  const api = { remove: vi.fn(remove) };
  const session = { expire: vi.fn(() => Promise.resolve()) };
  TestBed.configureTestingModule({
    providers: [
      DeleteEmployeeStore,
      { provide: EmployeesApi, useValue: api },
      { provide: AuthSession, useValue: session },
    ],
  });
  return { store: TestBed.inject(DeleteEmployeeStore), api, session };
}

function error(kind: ApiError['kind'], status: number): ApiError {
  return { kind, status, message: 'internal details', fieldErrors: {} };
}

describe('DeleteEmployeeStore', () => {
  it('opens the confirmation without calling the API', () => {
    const { store, api } = setup();

    store.open(employee);

    expect(store.employee()).toEqual(employee);
    expect(api.remove).not.toHaveBeenCalled();
  });

  it('closes without calling the API', () => {
    const { store, api } = setup();
    store.open(employee);

    store.close();

    expect(store.employee()).toBeNull();
    expect(api.remove).not.toHaveBeenCalled();
  });

  it('deletes on confirm and closes', async () => {
    const { store, api } = setup();
    store.open(employee);

    expect(await store.confirm()).toBe('deleted');
    expect(api.remove).toHaveBeenCalledWith('e1');
    expect(store.employee()).toBeNull();
  });

  it('does nothing when there is nothing to confirm', async () => {
    const { store, api } = setup();

    expect(await store.confirm()).toBe('failed');
    expect(api.remove).not.toHaveBeenCalled();
  });

  it('is pending while deleting, ignores double confirms and cannot be closed', async () => {
    const response = new Subject<void>();
    const { store, api } = setup(() => response.asObservable());
    store.open(employee);

    const first = store.confirm();
    expect(store.pending()).toBe(true);
    expect(await store.confirm()).toBe('failed');
    store.close();
    expect(store.employee()).toEqual(employee);

    response.next();
    response.complete();
    expect(await first).toBe('deleted');
    expect(api.remove).toHaveBeenCalledTimes(1);
  });

  it('keeps the dialog with a blocking failure on 409 and does not retry', async () => {
    const { store, api } = setup(() => throwError(() => error('conflict', 409)));
    store.open(employee);

    expect(await store.confirm()).toBe('failed');
    expect(store.employee()).toEqual(employee);
    expect(store.failure()).toMatchObject({
      title: DELETE_EMPLOYEE_MESSAGES.blockedTitle,
      summary: futureAppointmentsMessage(employee),
      blocked: true,
    });

    expect(await store.confirm()).toBe('failed');
    expect(api.remove).toHaveBeenCalledTimes(1);
  });

  it('closes on 404 without a failure message', async () => {
    const { store } = setup(() => throwError(() => error('not-found', 404)));
    store.open(employee);

    expect(await store.confirm()).toBe('not-found');
    expect(store.employee()).toBeNull();
    expect(store.failure()).toBeNull();
  });

  it('lets the user retry after a network error', async () => {
    let fail = true;
    const { store } = setup(() => (fail ? throwError(() => error('network', 0)) : of(undefined)));
    store.open(employee);

    expect(await store.confirm()).toBe('failed');
    expect(store.failure()).toMatchObject({
      summary: DELETE_EMPLOYEE_MESSAGES.network,
      blocked: false,
    });

    fail = false;
    expect(await store.confirm()).toBe('deleted');
  });

  it('ends the session on 401', async () => {
    const { store, session } = setup(() => throwError(() => error('unauthorized', 401)));
    store.open(employee);

    expect(await store.confirm()).toBe('failed');
    expect(session.expire).toHaveBeenCalledTimes(1);
    expect(store.employee()).toBeNull();
  });

  it('treats unknown errors as unexpected', async () => {
    const { store } = setup(() => throwError(() => new Error('boom')));
    store.open(employee);

    expect(await store.confirm()).toBe('failed');
    expect(store.failure()?.summary).toBe(DELETE_EMPLOYEE_MESSAGES.unexpected);
  });
});
