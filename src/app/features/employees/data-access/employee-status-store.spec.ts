import { TestBed } from '@angular/core/testing';
import { AuthSession } from '@core/auth/auth-session';
import { ApiError } from '@core/http/api-error.model';
import { Observable, of, Subject, throwError } from 'rxjs';
import { EMPLOYEE_STATUS_MESSAGES } from '../models/employee-status-messages';
import { Employee, EmployeeStatus } from '../models/employee.model';
import { EmployeeStatusStore } from './employee-status-store';
import { EmployeesApi } from './employees-api';

const active: Employee = {
  id: 'e1',
  firstName: 'Ana',
  lastName: 'López',
  fullName: 'Ana López',
  phone: null,
  email: null,
  status: 'ACTIVE',
  services: [{ id: 'svc-1', name: 'Corte' }],
};
const inactive: Employee = { ...active, id: 'e2', status: 'INACTIVE' };

function setup(
  changeStatus: (id: string, status: EmployeeStatus) => Observable<EmployeeStatus> = (
    _id,
    status,
  ) => of(status),
) {
  const api = { changeStatus: vi.fn(changeStatus) };
  const session = { expire: vi.fn(() => Promise.resolve()) };
  TestBed.configureTestingModule({
    providers: [
      EmployeeStatusStore,
      { provide: EmployeesApi, useValue: api },
      { provide: AuthSession, useValue: session },
    ],
  });
  return { store: TestBed.inject(EmployeeStatusStore), api, session };
}

function error(kind: ApiError['kind'], status: number): ApiError {
  return { kind, status, message: 'internal details', fieldErrors: {} };
}

describe('EmployeeStatusStore', () => {
  it('deactivates an active employee', async () => {
    const { store, api } = setup();

    expect(await store.toggle(active)).toEqual({ kind: 'changed', status: 'INACTIVE' });
    expect(api.changeStatus).toHaveBeenCalledWith('e1', 'INACTIVE');
  });

  it('activates an inactive employee', async () => {
    const { store, api } = setup();

    expect(await store.toggle(inactive)).toEqual({ kind: 'changed', status: 'ACTIVE' });
    expect(api.changeStatus).toHaveBeenCalledWith('e2', 'ACTIVE');
  });

  it('uses the status the backend answered', async () => {
    const { store } = setup(() => of('ACTIVE'));

    expect(await store.toggle(active)).toEqual({ kind: 'changed', status: 'ACTIVE' });
  });

  it('marks only that employee as pending and ignores a second click', async () => {
    const response = new Subject<EmployeeStatus>();
    const { store, api } = setup(() => response.asObservable());

    const first = store.toggle(active);
    expect(store.pendingIds().has('e1')).toBe(true);
    expect(store.pendingIds().has('e2')).toBe(false);
    expect(await store.toggle(active)).toEqual({ kind: 'ignored' });

    response.next('INACTIVE');
    response.complete();
    await first;
    expect(store.pendingIds().size).toBe(0);
    expect(api.changeStatus).toHaveBeenCalledTimes(1);
  });

  it('lets two employees change at the same time', async () => {
    const response = new Subject<EmployeeStatus>();
    const { store, api } = setup(() => response.asObservable());

    const both = Promise.all([store.toggle(active), store.toggle(inactive)]);
    expect([...store.pendingIds()]).toEqual(['e1', 'e2']);
    response.next('ACTIVE');
    response.complete();
    await both;

    expect(api.changeStatus).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['not-found', 404, EMPLOYEE_STATUS_MESSAGES.notFound],
    ['network', 0, EMPLOYEE_STATUS_MESSAGES.network],
    ['server', 500, EMPLOYEE_STATUS_MESSAGES.unexpected],
  ] as const)('reports %s and frees the toggle', async (kind, status, message) => {
    const { store } = setup(() => throwError(() => error(kind, status)));

    expect(await store.toggle(active)).toEqual({
      kind: 'failed',
      message,
      gone: kind === 'not-found',
    });
    expect(store.pendingIds().size).toBe(0);
  });

  it('treats unknown errors as unexpected', async () => {
    const { store } = setup(() => throwError(() => new Error('boom')));

    expect(await store.toggle(active)).toEqual({
      kind: 'failed',
      message: EMPLOYEE_STATUS_MESSAGES.unexpected,
      gone: false,
    });
  });

  it('ends the session on 401', async () => {
    const { store, session } = setup(() => throwError(() => error('unauthorized', 401)));

    expect(await store.toggle(active)).toEqual({ kind: 'ignored' });
    expect(session.expire).toHaveBeenCalledTimes(1);
  });
});
