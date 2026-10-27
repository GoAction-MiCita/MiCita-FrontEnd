import { TestBed } from '@angular/core/testing';
import { AuthSession } from '@core/auth/auth-session';
import { ApiError } from '@core/http/api-error.model';
import { Observable, of, Subject, throwError } from 'rxjs';
import { EMPLOYEE_FORM_MESSAGES } from '../models/employee-form-failure';
import { Employee, NewEmployee } from '../models/employee.model';
import { EditEmployeeStore } from './edit-employee-store';
import { EmployeesApi } from './employees-api';

const ana: Employee = {
  id: 'e1',
  firstName: 'Ana',
  lastName: 'López',
  fullName: 'Ana López',
  phone: null,
  email: 'ana@correo.com',
  status: 'ACTIVE',
  services: [{ id: 's1', name: 'Corte' }],
};

const changes: NewEmployee = {
  firstName: 'Ana',
  lastName: 'Gómez',
  phone: null,
  email: 'ana@correo.com',
  status: 'INACTIVE',
  serviceIds: ['s1'],
};

function setup(
  get: (id: string) => Observable<Employee> = () => of(ana),
  update: (id: string, changes: NewEmployee) => Observable<Employee> = () => of(ana),
) {
  const expire = vi.fn(() => Promise.resolve());
  const updateSpy = vi.fn(update);
  TestBed.configureTestingModule({
    providers: [
      EditEmployeeStore,
      { provide: EmployeesApi, useValue: { get: vi.fn(get), update: updateSpy } },
      { provide: AuthSession, useValue: { expire } },
    ],
  });
  return { store: TestBed.inject(EditEmployeeStore), update: updateSpy, expire };
}

function apiError(kind: ApiError['kind'], fieldErrors: ApiError['fieldErrors'] = {}): ApiError {
  return { kind, status: 0, message: 'detalle interno', fieldErrors };
}

describe('EditEmployeeStore', () => {
  it('is loading until the employee arrives and then keeps it', async () => {
    const response = new Subject<Employee>();
    const { store } = setup(() => response.asObservable());

    const loaded = store.load('e1');
    expect(store.loading()).toBe(true);
    expect(store.employee()).toBeNull();

    response.next(ana);
    response.complete();

    expect(await loaded).toBe('loaded');
    expect(store.loading()).toBe(false);
    expect(store.employee()).toEqual(ana);
  });

  it('reports a 404 on load to the page without a failure', async () => {
    const { store } = setup(() => throwError(() => apiError('not-found')));

    expect(await store.load('e1')).toBe('not-found');
    expect(store.failure()).toBeNull();
    expect(store.loading()).toBe(false);
  });

  it('shows a load failure with its own title and no server details', async () => {
    const { store } = setup(() => throwError(() => apiError('server')));

    expect(await store.load('e1')).toBe('failed');
    expect(store.failure()).toEqual({
      title: EMPLOYEE_FORM_MESSAGES.loadTitle,
      summary: EMPLOYEE_FORM_MESSAGES.unexpected,
      fieldErrors: {},
    });
  });

  it('ignores an answer that arrives after reset (closed or reopened panel)', async () => {
    const response = new Subject<Employee>();
    const { store } = setup(() => response.asObservable());

    const loaded = store.load('e1');
    store.reset();
    response.next(ana);
    response.complete();

    expect(await loaded).toBe('stale');
    expect(store.employee()).toBeNull();
  });

  it('saves the changes of the loaded employee, pending meanwhile and once', async () => {
    const response = new Subject<Employee>();
    const { store, update } = setup(undefined, () => response.asObservable());
    await store.load('e1');

    const saved = store.save(changes);
    expect(store.pending()).toBe(true);
    expect(await store.save(changes)).toBe('failed');

    response.next(ana);
    response.complete();

    expect(await saved).toBe('saved');
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith('e1', changes);
    expect(store.pending()).toBe(false);
  });

  it('does not save before the employee is loaded', async () => {
    const { store, update } = setup();

    expect(await store.save(changes)).toBe('failed');
    expect(update).not.toHaveBeenCalled();
  });

  it('keeps the employee and the 409 on the duplicated field', async () => {
    const { store } = setup(undefined, () =>
      throwError(() => apiError('conflict', { email: 'dup' })),
    );
    await store.load('e1');

    expect(await store.save(changes)).toBe('failed');
    expect(store.employee()).toEqual(ana);
    expect(store.failure()).toEqual({
      title: EMPLOYEE_FORM_MESSAGES.updateTitle,
      summary: EMPLOYEE_FORM_MESSAGES.duplicate,
      fieldErrors: { email: EMPLOYEE_FORM_MESSAGES.duplicateEmail },
    });
  });

  it('resolves serviceIds[i] of a 400 against the list sent, without duplicates', async () => {
    const { store } = setup(undefined, () =>
      throwError(() => apiError('validation', { 'serviceIds[1]': 'x' })),
    );
    await store.load('e1');

    await store.save({ ...changes, serviceIds: ['s1', 's1', 's2'] });

    expect(store.failure()?.rejectedServiceIds).toEqual(['s2']);
  });

  it('reports a 404 on save to the page', async () => {
    const { store } = setup(undefined, () => throwError(() => apiError('not-found')));
    await store.load('e1');

    expect(await store.save(changes)).toBe('not-found');
    expect(store.failure()).toBeNull();
  });

  it('ends the session on a 401', async () => {
    const { store, expire } = setup(undefined, () => throwError(() => apiError('unauthorized')));
    await store.load('e1');

    expect(await store.save(changes)).toBe('failed');
    expect(expire).toHaveBeenCalledTimes(1);
    expect(store.failure()).toBeNull();
  });

  it('treats unknown errors as unexpected', async () => {
    const { store } = setup(undefined, () => throwError(() => new Error('boom')));
    await store.load('e1');

    await store.save(changes);

    expect(store.failure()?.summary).toBe(EMPLOYEE_FORM_MESSAGES.unexpected);
  });
});
