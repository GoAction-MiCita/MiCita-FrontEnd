import { TestBed } from '@angular/core/testing';
import { AuthSession } from '@core/auth/auth-session';
import { ApiError } from '@core/http/api-error.model';
import { Observable, of, Subject, throwError } from 'rxjs';
import { SERVICE_STATUS_MESSAGES } from '../models/service-status-messages';
import { Service, ServiceStatus } from '../models/service.model';
import { ServiceStatusStore } from './service-status-store';
import { ServicesApi } from './services-api';

const active: Service = {
  id: 's1',
  name: 'Barba',
  description: null,
  durationMinutes: 20,
  price: 20000,
  status: 'ACTIVE',
  employees: [],
};
const inactive: Service = { ...active, id: 's2', status: 'INACTIVE' };

function setup(
  changeStatus: (id: string, status: ServiceStatus) => Observable<ServiceStatus> = (_id, status) =>
    of(status),
) {
  const api = { changeStatus: vi.fn(changeStatus) };
  const session = { expire: vi.fn(() => Promise.resolve()) };
  TestBed.configureTestingModule({
    providers: [
      ServiceStatusStore,
      { provide: ServicesApi, useValue: api },
      { provide: AuthSession, useValue: session },
    ],
  });
  return { store: TestBed.inject(ServiceStatusStore), api, session };
}

function error(kind: ApiError['kind'], status: number): ApiError {
  return { kind, status, message: 'internal details', fieldErrors: {} };
}

describe('ServiceStatusStore', () => {
  it('deactivates an active service', async () => {
    const { store, api } = setup();

    expect(await store.toggle(active)).toEqual({ kind: 'changed', status: 'INACTIVE' });
    expect(api.changeStatus).toHaveBeenCalledWith('s1', 'INACTIVE');
  });

  it('activates an inactive service', async () => {
    const { store, api } = setup();

    expect(await store.toggle(inactive)).toEqual({ kind: 'changed', status: 'ACTIVE' });
    expect(api.changeStatus).toHaveBeenCalledWith('s2', 'ACTIVE');
  });

  it('uses the status the backend answered', async () => {
    const { store } = setup(() => of('ACTIVE'));

    expect(await store.toggle(active)).toEqual({ kind: 'changed', status: 'ACTIVE' });
  });

  it('marks only that service as pending and ignores a second click', async () => {
    const response = new Subject<ServiceStatus>();
    const { store, api } = setup(() => response.asObservable());

    const first = store.toggle(active);
    expect(store.pendingIds().has('s1')).toBe(true);
    expect(store.pendingIds().has('s2')).toBe(false);
    expect(await store.toggle(active)).toEqual({ kind: 'ignored' });

    response.next('INACTIVE');
    response.complete();
    await first;
    expect(store.pendingIds().size).toBe(0);
    expect(api.changeStatus).toHaveBeenCalledTimes(1);
  });

  it('lets two services change at the same time', async () => {
    const response = new Subject<ServiceStatus>();
    const { store, api } = setup(() => response.asObservable());

    const both = Promise.all([store.toggle(active), store.toggle(inactive)]);
    expect([...store.pendingIds()]).toEqual(['s1', 's2']);
    response.next('ACTIVE');
    response.complete();
    await both;

    expect(api.changeStatus).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['not-found', 404, SERVICE_STATUS_MESSAGES.notFound],
    ['network', 0, SERVICE_STATUS_MESSAGES.network],
    ['server', 500, SERVICE_STATUS_MESSAGES.unexpected],
  ] as const)('reports %s and frees the toggle', async (kind, status, message) => {
    const { store } = setup(() => throwError(() => error(kind, status)));

    expect(await store.toggle(active)).toEqual({ kind: 'failed', message });
    expect(store.pendingIds().size).toBe(0);
  });

  it('treats unknown errors as unexpected', async () => {
    const { store } = setup(() => throwError(() => new Error('boom')));

    expect(await store.toggle(active)).toEqual({
      kind: 'failed',
      message: SERVICE_STATUS_MESSAGES.unexpected,
    });
  });

  it('ends the session on 401', async () => {
    const { store, session } = setup(() => throwError(() => error('unauthorized', 401)));

    expect(await store.toggle(active)).toEqual({ kind: 'ignored' });
    expect(session.expire).toHaveBeenCalledTimes(1);
  });
});
