import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ApiError } from '@core/http/api-error.model';
import { Observable, of, Subject, throwError } from 'rxjs';
import { Paging } from '@shared/ui/paginator/paging';
import { EmployeeFilters, NO_EMPLOYEE_FILTERS } from '../models/employee-filters';
import { EmployeePage } from '../models/employee.model';
import { EMPLOYEES_ERROR_MESSAGES } from '../models/employees-error';
import { EmployeesApi } from './employees-api';
import { EmployeesStore } from './employees-store';

const page: EmployeePage = {
  items: [
    {
      id: 'e1',
      firstName: 'Ana',
      lastName: 'López',
      fullName: 'Ana López',
      phone: null,
      email: null,
      status: 'ACTIVE',
      services: [],
    },
  ],
  page: 0,
  size: 20,
  totalElements: 1,
  totalPages: 1,
};
const emptyPage: EmployeePage = { ...page, items: [], totalElements: 0, totalPages: 0 };

function setup(list: (paging: Paging, filters: EmployeeFilters) => Observable<EmployeePage>) {
  // Records the page only, as most tests care about it; filters go to `filters`.
  const filters = vi.fn<(filters: EmployeeFilters) => void>();
  const spy = vi.fn((paging: Paging) =>
    list(paging, filters.mock.lastCall?.[0] ?? NO_EMPLOYEE_FILTERS),
  );
  TestBed.configureTestingModule({
    providers: [
      EmployeesStore,
      {
        provide: EmployeesApi,
        useValue: {
          list: (f: EmployeeFilters, paging: Paging) => {
            filters(f);
            return spy(paging);
          },
        },
      },
    ],
  });
  return { store: TestBed.inject(EmployeesStore), list: spy, filters };
}

const settle = () => TestBed.inject(ApplicationRef).whenStable();

function apiError(kind: ApiError['kind']): ApiError {
  return { kind, status: 0, message: null, fieldErrors: {} };
}

describe('EmployeesStore', () => {
  it('is loading until the page arrives', async () => {
    const response = new Subject<EmployeePage>();
    const { store } = setup(() => response.asObservable());
    await Promise.resolve();
    TestBed.tick();

    expect(store.loading()).toBe(true);

    response.next(page);
    response.complete();
    await settle();

    expect(store.loading()).toBe(false);
    expect(store.employees()).toEqual(page.items);
    expect(store.totals()).toEqual({ totalElements: 1, totalPages: 1 });
    expect(store.empty()).toBe(false);
  });

  it('reports a business without employees', async () => {
    const { store } = setup(() => of(emptyPage));
    await settle();

    expect(store.empty()).toBe(true);
    expect(store.error()).toBeNull();
  });

  it('maps a 403 to "business required"', async () => {
    const { store } = setup(() => throwError(() => apiError('forbidden')));
    await settle();

    expect(store.error()).toEqual({
      message: EMPLOYEES_ERROR_MESSAGES.businessRequired,
      retryable: false,
      businessRequired: true,
      invalidFilter: false,
    });
    expect(store.empty()).toBe(false);
  });

  it('retries after an error', async () => {
    let fail = true;
    const { store, list } = setup(() => (fail ? throwError(() => apiError('network')) : of(page)));
    await settle();
    expect(store.error()?.retryable).toBe(true);

    fail = false;
    store.reload();
    await settle();

    expect(list).toHaveBeenCalledTimes(2);
    expect(store.error()).toBeNull();
    expect(store.employees()).toEqual(page.items);
  });

  it('fetches the asked page, and not again for the same one', async () => {
    const { store, list } = setup((paging) => of({ ...page, ...paging }));
    await settle();

    store.setPaging({ page: 2, size: 50 });
    await settle();
    store.setPaging({ page: 2, size: 50 });
    await settle();

    expect(list).toHaveBeenCalledTimes(2);
    expect(list).toHaveBeenLastCalledWith({ page: 2, size: 50 });
  });

  it('points to the last page when the asked one is past the end', async () => {
    const { store } = setup((paging) =>
      of({ ...page, items: paging.page < 2 ? page.items : [], totalElements: 30, totalPages: 2 }),
    );
    store.setPaging({ page: 5, size: 20 });
    await settle();

    expect(store.lastPageIfOutOfRange()).toBe(1);
    expect(store.empty()).toBe(false);
  });
});

describe('EmployeesStore.setStatus (HU-20)', () => {
  it('changes the status of one employee without fetching again', async () => {
    const { store, list } = setup(() => of(page));
    await settle();

    store.setStatus('e1', 'INACTIVE');

    expect(store.employees()[0].status).toBe('INACTIVE');
    expect(list).toHaveBeenCalledTimes(1);
  });

  it('ignores unknown ids', async () => {
    const { store } = setup(() => of(page));
    await settle();

    store.setStatus('nope', 'INACTIVE');

    expect(store.employees()).toEqual(page.items);
  });

  it('does not cancel a load in flight (it already brings the stored status)', async () => {
    const second = new Subject<EmployeePage>();
    let calls = 0;
    const { store } = setup(() => (calls++ === 0 ? of(page) : second.asObservable()));
    await settle();

    store.setPaging({ page: 1, size: 20 });
    // Not settle(): it would wait for the load that is meant to stay in flight.
    await Promise.resolve();
    TestBed.tick();
    expect(store.loading()).toBe(true);

    store.setStatus('e1', 'INACTIVE');
    second.next({ ...page, page: 1, items: [{ ...page.items[0], id: 'new' }] });
    second.complete();
    await settle();

    expect(store.loading()).toBe(false);
    expect(store.employees().map((item) => item.id)).toEqual(['new']);
  });
});

describe('EmployeesStore filters (HU-22)', () => {
  const ana: EmployeeFilters = { name: 'ana', status: 'ACTIVE', serviceIds: ['s1'] };

  it('fetches with the filters and the page of the query', async () => {
    const { store, list, filters } = setup(() => of(page));
    store.setPaging({ page: 2, size: 50 });
    await settle();

    store.setQuery(ana, { page: 0, size: 50 });
    await settle();

    expect(filters).toHaveBeenLastCalledWith(ana);
    expect(list).toHaveBeenLastCalledWith({ page: 0, size: 50 });
    expect(store.filtered()).toBe(true);
  });

  it('does not fetch again for the same filters or query', async () => {
    const { store, list } = setup(() => of(page));
    store.setQuery(ana, { page: 1, size: 20 });
    await settle();

    store.setQuery(ana, { page: 1, size: 20 });
    await settle();

    expect(list).toHaveBeenCalledTimes(1);
    expect(list).toHaveBeenLastCalledWith({ page: 1, size: 20 });
  });

  it('tells "no results" apart from "no employees"', async () => {
    const { store } = setup(() => of(emptyPage));
    store.setQuery(ana, { page: 0, size: 20 });
    await settle();

    expect(store.noResults()).toBe(true);
    expect(store.empty()).toBe(false);
  });

  it('marks a 400 on serviceIds as a rejected filter', async () => {
    const { store } = setup(() =>
      throwError(() => ({ ...apiError('validation'), fieldErrors: { 'serviceIds[0]': 'x' } })),
    );
    store.setQuery(ana, { page: 0, size: 20 });
    await settle();

    expect(store.error()?.invalidFilter).toBe(true);
  });
});
