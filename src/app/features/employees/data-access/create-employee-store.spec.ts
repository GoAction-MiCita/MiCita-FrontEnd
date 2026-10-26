import { TestBed } from '@angular/core/testing';
import { AuthSession } from '@core/auth/auth-session';
import { ApiError } from '@core/http/api-error.model';
import { Observable, of, Subject, throwError } from 'rxjs';
import { EMPLOYEE_FORM_MESSAGES } from '../models/employee-form-failure';
import { Employee, NewEmployee } from '../models/employee.model';
import { CreateEmployeeStore } from './create-employee-store';
import { EmployeesApi } from './employees-api';

const newEmployee: NewEmployee = {
  firstName: 'Eva',
  lastName: 'Ruiz',
  phone: null,
  email: null,
  status: 'ACTIVE',
  serviceIds: ['s1'],
};

const created = { id: 'e9' } as Employee;

function setup(create: () => Observable<Employee>) {
  const expire = vi.fn(() => Promise.resolve());
  const createSpy = vi.fn(create);
  TestBed.configureTestingModule({
    providers: [
      CreateEmployeeStore,
      { provide: EmployeesApi, useValue: { create: createSpy } },
      { provide: AuthSession, useValue: { expire } },
    ],
  });
  return { store: TestBed.inject(CreateEmployeeStore), create: createSpy, expire };
}

function apiError(kind: ApiError['kind'], fieldErrors: ApiError['fieldErrors'] = {}): ApiError {
  return { kind, status: 0, message: null, fieldErrors };
}

describe('CreateEmployeeStore', () => {
  it('is pending while the request is in flight and ignores a second submit', async () => {
    const response = new Subject<Employee>();
    const { store, create } = setup(() => response.asObservable());

    const first = store.create(newEmployee);
    expect(store.pending()).toBe(true);
    expect(await store.create(newEmployee)).toBe(false);

    response.next(created);
    response.complete();

    expect(await first).toBe(true);
    expect(create).toHaveBeenCalledTimes(1);
    expect(store.pending()).toBe(false);
    expect(store.failure()).toBeNull();
  });

  it('keeps the 400 field errors and the rejected services', async () => {
    const { store } = setup(() =>
      throwError(() => apiError('validation', { 'serviceIds[0]': 'x' })),
    );

    expect(await store.create(newEmployee)).toBe(false);

    expect(store.failure()?.rejectedServiceIds).toEqual(['s1']);
    expect(store.pending()).toBe(false);
  });

  it('keeps the 409 on the duplicated field', async () => {
    const { store } = setup(() => throwError(() => apiError('conflict', { phone: 'dup' })));

    await store.create(newEmployee);

    expect(store.failure()?.fieldErrors).toEqual({
      phone: EMPLOYEE_FORM_MESSAGES.duplicatePhone,
    });
  });

  it('ends the session on a 401', async () => {
    const { store, expire } = setup(() => throwError(() => apiError('unauthorized')));

    expect(await store.create(newEmployee)).toBe(false);

    expect(expire).toHaveBeenCalled();
    expect(store.failure()).toBeNull();
  });

  it('forgets the last failure on reset()', async () => {
    const { store } = setup(() => throwError(() => apiError('network')));
    await store.create(newEmployee);

    store.reset();

    expect(store.failure()).toBeNull();
  });

  it('resolves true on success', async () => {
    const { store } = setup(() => of(created));

    expect(await store.create(newEmployee)).toBe(true);
  });
});
