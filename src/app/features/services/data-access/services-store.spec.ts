import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ApiError } from '@core/http/api-error.model';
import { Observable, of, Subject, throwError } from 'rxjs';
import { FIRST_PAGE } from '@shared/ui/paginator/paging';
import { NO_SERVICE_FILTERS } from '../models/service-filters';
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

describe('ServicesStore filters (HU-13)', () => {
  const active = { name: '', status: 'ACTIVE' as const, employeeIds: [] };

  it('starts without filters', async () => {
    const { store, list } = setup(() => of(page));
    await settle();

    expect(store.filtered()).toBe(false);
    expect(list).toHaveBeenCalledWith(NO_SERVICE_FILTERS, FIRST_PAGE);
  });

  it('fetches again with the new filters', async () => {
    const { store, list } = setup(() => of(page));
    await settle();

    store.setQuery(active, FIRST_PAGE);
    await settle();

    expect(store.filtered()).toBe(true);
    expect(list).toHaveBeenLastCalledWith(active, FIRST_PAGE);
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('does not fetch again for equal filters', async () => {
    const { store, list } = setup(() => of(page));
    store.setQuery(active, FIRST_PAGE);
    await settle();

    store.setQuery({ ...active, employeeIds: [] }, FIRST_PAGE);
    await settle();

    expect(list).toHaveBeenCalledTimes(1);
  });

  it('tells "no results for these filters" apart from "no services"', async () => {
    const { store } = setup(() => of(emptyPage));
    await settle();
    expect(store.empty()).toBe(true);
    expect(store.noResults()).toBe(false);

    store.setQuery(active, FIRST_PAGE);
    await settle();
    expect(store.empty()).toBe(false);
    expect(store.noResults()).toBe(true);
  });

  it('keeps the filters on reload', async () => {
    const { store, list } = setup(() => of(page));
    store.setQuery(active, FIRST_PAGE);
    await settle();

    store.reload();
    await settle();

    expect(list).toHaveBeenLastCalledWith(active, FIRST_PAGE);
  });
});

describe('ServicesStore.setStatus (HU-11)', () => {
  it('changes the status of one service without fetching again', async () => {
    const { store, list } = setup(() => of(page));
    await settle();

    store.setStatus('s1', 'INACTIVE');

    expect(store.services()[0].status).toBe('INACTIVE');
    expect(list).toHaveBeenCalledTimes(1);
  });

  it('ignores unknown ids', async () => {
    const { store } = setup(() => of(page));
    await settle();

    store.setStatus('nope', 'INACTIVE');

    expect(store.services()).toEqual(page.items);
  });

  it('does not cancel a load in flight (it already brings the stored status)', async () => {
    const second = new Subject<ServicePage>();
    let calls = 0;
    const { store } = setup(() => (calls++ === 0 ? of(page) : second.asObservable()));
    await settle();

    store.setPaging({ page: 1, size: 20 });
    // Not settle(): it would wait for the load that is meant to stay in flight.
    await Promise.resolve();
    TestBed.tick();
    expect(store.loading()).toBe(true);

    store.setStatus('s1', 'INACTIVE');
    second.next({ ...page, page: 1, items: [{ ...page.items[0], id: 'new' }] });
    second.complete();
    await settle();

    expect(store.loading()).toBe(false);
    expect(store.services().map((item) => item.id)).toEqual(['new']);
  });
});

describe('ServicesStore paging (HU-15)', () => {
  const pageOf = (totalElements: number, page = 0, size = 20, items = page0Items): ServicePage => ({
    items,
    page,
    size,
    totalElements,
    totalPages: Math.ceil(totalElements / size),
  });
  const page0Items = page.items;

  it('asks for the requested page with the same filters', async () => {
    const { store, list } = setup(() => of(pageOf(57)));
    store.setQuery({ name: 'cor', status: null, employeeIds: [] }, FIRST_PAGE);
    await settle();

    store.setPaging({ page: 2, size: 20 });
    await settle();

    expect(list).toHaveBeenLastCalledWith(
      { name: 'cor', status: null, employeeIds: [] },
      { page: 2, size: 20 },
    );
    expect(store.totals()).toEqual({ totalElements: 57, totalPages: 3 });
  });

  it('applies filters and page from the URL in one request', async () => {
    const { store, list } = setup(() => of(pageOf(57)));
    await settle();
    const before = list.mock.calls.length;

    store.setQuery({ name: 'a', status: null, employeeIds: [] }, { page: 1, size: 100 });
    store.setQuery({ name: 'a', status: null, employeeIds: [] }, { page: 1, size: 100 });
    await settle();

    expect(list.mock.calls.length - before).toBe(1);
  });

  it('points to the last page when the requested one is past the end', async () => {
    const { store } = setup(() => of(pageOf(41, 3, 20, [])));
    store.setPaging({ page: 3, size: 20 });
    await settle();

    expect(store.lastPageIfOutOfRange()).toBe(2);
    expect(store.empty()).toBe(false);
    expect(store.noResults()).toBe(false);
  });

  it('does not point anywhere for a normal page', async () => {
    const { store } = setup(() => of(pageOf(41)));
    await settle();

    expect(store.lastPageIfOutOfRange()).toBeNull();
  });
});
