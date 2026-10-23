import { TestBed } from '@angular/core/testing';
import { AuthSession } from '@core/auth/auth-session';
import { ApiError } from '@core/http/api-error.model';
import { Observable, of, Subject, throwError } from 'rxjs';
import { SERVICE_FORM_MESSAGES } from '../models/service-form-failure';
import { NewService, Service } from '../models/service.model';
import { EditServiceStore } from './edit-service-store';
import { ServicesApi } from './services-api';

const service: Service = {
  id: 's1',
  name: 'Barba',
  description: 'Arreglo',
  durationMinutes: 20,
  price: 20000,
  status: 'ACTIVE',
  employees: [
    { id: 'e1', name: 'Juan Pérez', photoUrl: null },
    { id: 'e2', name: 'Pedro Ruiz', photoUrl: null },
  ],
};

const changes: NewService = {
  name: 'Barba clásica',
  description: null,
  durationMinutes: 30,
  price: 25000,
  status: 'INACTIVE',
};

function setup({
  get = (): Observable<Service> => of(service),
  update = (): Observable<Service> => of({ ...service, ...changes }),
} = {}) {
  const api = { get: vi.fn(get), update: vi.fn(update) };
  const session = { expire: vi.fn(() => Promise.resolve()) };
  TestBed.configureTestingModule({
    providers: [
      EditServiceStore,
      { provide: ServicesApi, useValue: api },
      { provide: AuthSession, useValue: session },
    ],
  });
  return { store: TestBed.inject(EditServiceStore), api, session };
}

function error(kind: ApiError['kind'], status: number): ApiError {
  return { kind, status, message: 'internal details', fieldErrors: {} };
}

describe('EditServiceStore', () => {
  it('loads the current service', async () => {
    const response = new Subject<Service>();
    const { store, api } = setup({ get: () => response.asObservable() });

    const load = store.load('s1');
    expect(store.loading()).toBe(true);
    response.next(service);
    response.complete();

    expect(await load).toBe('loaded');
    expect(api.get).toHaveBeenCalledWith('s1');
    expect(store.loading()).toBe(false);
    expect(store.service()).toEqual(service);
  });

  it('reports a 404 on load without a failure message', async () => {
    const { store } = setup({ get: () => throwError(() => error('not-found', 404)) });

    expect(await store.load('s1')).toBe('not-found');
    expect(store.service()).toBeNull();
    expect(store.failure()).toBeNull();
  });

  it('explains other load errors without server details', async () => {
    const { store } = setup({ get: () => throwError(() => error('network', 0)) });

    expect(await store.load('s1')).toBe('failed');
    expect(store.failure()).toEqual({
      title: SERVICE_FORM_MESSAGES.loadTitle,
      summary: SERVICE_FORM_MESSAGES.network,
      fieldErrors: {},
    });
  });

  it('ignores an answer that arrives after reset (panel closed)', async () => {
    const response = new Subject<Service>();
    const { store } = setup({ get: () => response.asObservable() });

    const load = store.load('s1');
    store.reset();
    response.next(service);
    response.complete();

    expect(await load).toBe('stale');
    expect(store.service()).toBeNull();
    expect(store.loading()).toBe(false);
  });

  it('saves the changes keeping the current employees', async () => {
    const { store, api } = setup();
    await store.load('s1');

    expect(await store.save(changes)).toBe('saved');
    expect(api.update).toHaveBeenCalledWith('s1', changes, ['e1', 'e2']);
    expect(store.pending()).toBe(false);
    expect(store.failure()).toBeNull();
  });

  it('does not save before the service is loaded', async () => {
    const { store, api } = setup();

    expect(await store.save(changes)).toBe('failed');
    expect(api.update).not.toHaveBeenCalled();
  });

  it('is pending while saving and ignores double submits', async () => {
    const response = new Subject<Service>();
    const { store, api } = setup({ update: () => response.asObservable() });
    await store.load('s1');

    const first = store.save(changes);
    expect(store.pending()).toBe(true);
    expect(await store.save(changes)).toBe('failed');

    response.next(service);
    response.complete();
    expect(await first).toBe('saved');
    expect(api.update).toHaveBeenCalledTimes(1);
  });

  it('keeps the service and shows field errors after a 409', async () => {
    const { store } = setup({ update: () => throwError(() => error('conflict', 409)) });
    await store.load('s1');

    expect(await store.save(changes)).toBe('failed');
    expect(store.service()).toEqual(service);
    expect(store.failure()).toEqual({
      title: SERVICE_FORM_MESSAGES.updateTitle,
      summary: SERVICE_FORM_MESSAGES.duplicate,
      fieldErrors: { name: SERVICE_FORM_MESSAGES.duplicateName },
    });
  });

  it('maps a 400 to field errors', async () => {
    const { store } = setup({
      update: () =>
        throwError(() => ({ ...error('validation', 400), fieldErrors: { price: 'Inválido' } })),
    });
    await store.load('s1');

    expect(await store.save(changes)).toBe('failed');
    expect(store.failure()?.fieldErrors).toEqual({ price: 'Inválido' });
  });

  it('reports a 404 on save', async () => {
    const { store } = setup({ update: () => throwError(() => error('not-found', 404)) });
    await store.load('s1');

    expect(await store.save(changes)).toBe('not-found');
    expect(store.failure()).toBeNull();
  });

  it('ends the session on 401', async () => {
    const { store, session } = setup({
      update: () => throwError(() => error('unauthorized', 401)),
    });
    await store.load('s1');

    expect(await store.save(changes)).toBe('failed');
    expect(session.expire).toHaveBeenCalledTimes(1);
    expect(store.failure()).toBeNull();
  });

  it('treats unknown errors as unexpected', async () => {
    const { store } = setup({ update: () => throwError(() => new Error('boom')) });
    await store.load('s1');

    expect(await store.save(changes)).toBe('failed');
    expect(store.failure()?.summary).toBe(SERVICE_FORM_MESSAGES.unexpected);
  });
});
