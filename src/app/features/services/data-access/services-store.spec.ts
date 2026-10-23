import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ApiError } from '@core/http/api-error.model';
import { Observable, of, Subject, throwError } from 'rxjs';
import { ServicePage } from '../models/service.model';
import { SERVICES_ERROR_MESSAGES } from '../models/services-error';
import { ServicesApi } from './services-api';
import { ServicesStore } from './services-store';

const page: ServicePage = {
  items: [
    {
      id: 's1',
      name: 'Barba',
      description: null,
      durationMinutes: 20,
      price: 20000,
      status: 'ACTIVE',
      employees: [],
    },
  ],
  page: 0,
  size: 20,
  totalElements: 1,
  totalPages: 1,
};
const emptyPage: ServicePage = { ...page, items: [], totalElements: 0, totalPages: 0 };

function setup(list: () => Observable<ServicePage>) {
  const spy = vi.fn(list);
  TestBed.configureTestingModule({
    providers: [ServicesStore, { provide: ServicesApi, useValue: { list: spy } }],
  });
  return { store: TestBed.inject(ServicesStore), list: spy };
}

const settle = () => TestBed.inject(ApplicationRef).whenStable();

function apiError(kind: ApiError['kind']): ApiError {
  return { kind, status: 0, message: null, fieldErrors: {} };
}

describe('ServicesStore', () => {
  it('is loading until the list arrives', async () => {
    const response = new Subject<ServicePage>();
    const { store } = setup(() => response.asObservable());
    await Promise.resolve();
    TestBed.tick();

    expect(store.loading()).toBe(true);

    response.next(page);
    response.complete();
    await settle();

    expect(store.loading()).toBe(false);
    expect(store.services()).toEqual(page.items);
    expect(store.empty()).toBe(false);
  });

  it('reports an empty business', async () => {
    const { store } = setup(() => of(emptyPage));
    await settle();

    expect(store.empty()).toBe(true);
    expect(store.error()).toBeNull();
  });

  it('maps a 403 to a non-retryable "business required" message', async () => {
    const { store } = setup(() => throwError(() => apiError('forbidden')));
    await settle();

    expect(store.error()).toEqual({
      message: SERVICES_ERROR_MESSAGES.businessRequired,
      retryable: false,
    });
    expect(store.services()).toEqual([]);
    expect(store.empty()).toBe(false);
  });

  it('reloads after an error', async () => {
    let fail = true;
    const { store, list } = setup(() => (fail ? throwError(() => apiError('server')) : of(page)));
    await settle();
    expect(store.error()?.retryable).toBe(true);

    fail = false;
    store.reload();
    await settle();

    expect(list).toHaveBeenCalledTimes(2);
    expect(store.error()).toBeNull();
    expect(store.services()).toHaveLength(1);
  });
});
