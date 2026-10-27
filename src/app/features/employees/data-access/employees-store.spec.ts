import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ApiError } from '@core/http/api-error.model';
import { Observable, of, Subject, throwError } from 'rxjs';
import { Paging } from '@shared/ui/paginator/paging';
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

function setup(list: (paging: Paging) => Observable<EmployeePage>) {
  const spy = vi.fn(list);
  TestBed.configureTestingModule({
    providers: [EmployeesStore, { provide: EmployeesApi, useValue: { list: spy } }],
  });
  return { store: TestBed.inject(EmployeesStore), list: spy };
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
});
