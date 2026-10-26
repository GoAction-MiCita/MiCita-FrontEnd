import { TestBed } from '@angular/core/testing';
import { AuthSession } from '@core/auth/auth-session';
import { ApiError } from '@core/http/api-error.model';
import { Observable, of, Subject, throwError } from 'rxjs';
import { SERVICE_FORM_MESSAGES } from '../models/service-form-failure';
import { NewService, Service } from '../models/service.model';
import { CreateServiceStore } from './create-service-store';
import { ServicesApi } from './services-api';

const newService: NewService = {
  name: 'Corte',
  description: null,
  durationMinutes: 45,
  price: 45000,
  status: 'ACTIVE',
  employeeIds: [],
};
const service: Service = { id: 's9', ...newService, employees: [] };

function setup(create: () => Observable<Service>) {
  const session = { expire: vi.fn(() => Promise.resolve()) };
  TestBed.configureTestingModule({
    providers: [
      CreateServiceStore,
      { provide: ServicesApi, useValue: { create: vi.fn(create) } },
      { provide: AuthSession, useValue: session },
    ],
  });
  return { store: TestBed.inject(CreateServiceStore), session };
}

function error(kind: ApiError['kind'], status: number): ApiError {
  return { kind, status, message: null, fieldErrors: {} };
}

describe('CreateServiceStore', () => {
  it('resolves employeeIds[i] against the list sent, without duplicates', async () => {
    const rejected: ApiError = {
      ...error('validation', 400),
      fieldErrors: { 'employeeIds[1]': 'x' },
    };
    const { store } = setup(() => throwError(() => rejected));

    await store.create({ ...newService, employeeIds: ['e1', 'e1', 'e2'] });

    expect(store.failure()?.rejectedEmployeeIds).toEqual(['e2']);
  });

  it('creates the service', async () => {
    const { store } = setup(() => of(service));

    expect(await store.create(newService)).toBe(true);
    expect(store.failure()).toBeNull();
    expect(store.pending()).toBe(false);
  });

  it('is pending while the request is in flight and ignores double submits', async () => {
    const response = new Subject<Service>();
    const { store } = setup(() => response.asObservable());

    const first = store.create(newService);
    expect(store.pending()).toBe(true);
    expect(await store.create(newService)).toBe(false);

    response.next(service);
    response.complete();
    expect(await first).toBe(true);
    expect(store.pending()).toBe(false);
  });

  it('keeps the failure of a 409 until reset', async () => {
    const { store, session } = setup(() => throwError(() => error('conflict', 409)));

    expect(await store.create(newService)).toBe(false);
    expect(store.failure()?.fieldErrors).toEqual({ name: SERVICE_FORM_MESSAGES.duplicateName });
    expect(session.expire).not.toHaveBeenCalled();

    store.reset();
    expect(store.failure()).toBeNull();
  });

  it('treats unknown errors as unexpected', async () => {
    const { store } = setup(() => throwError(() => new Error('boom')));

    expect(await store.create(newService)).toBe(false);
    expect(store.failure()?.summary).toBe(SERVICE_FORM_MESSAGES.unexpected);
  });

  it('ends the session on 401', async () => {
    const { store, session } = setup(() => throwError(() => error('unauthorized', 401)));

    expect(await store.create(newService)).toBe(false);
    expect(session.expire).toHaveBeenCalledTimes(1);
    expect(store.failure()).toBeNull();
  });
});
