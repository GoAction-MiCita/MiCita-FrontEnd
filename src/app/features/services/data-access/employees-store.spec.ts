import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, of, Subject, throwError } from 'rxjs';
import { ServiceEmployee } from '../models/service.model';
import { EmployeesApi } from './employees-api';
import { EmployeesStore } from './employees-store';

const team: ServiceEmployee[] = [{ id: 'e1', name: 'Ana López', photoUrl: null }];

function setup(list: () => Observable<readonly ServiceEmployee[]>) {
  const spy = vi.fn(list);
  TestBed.configureTestingModule({
    providers: [EmployeesStore, { provide: EmployeesApi, useValue: { list: spy } }],
  });
  return { store: TestBed.inject(EmployeesStore), list: spy };
}

const settle = () => TestBed.inject(ApplicationRef).whenStable();

describe('EmployeesStore', () => {
  it('loads the employees once', async () => {
    const response = new Subject<readonly ServiceEmployee[]>();
    const { store, list } = setup(() => response.asObservable());
    TestBed.inject(ApplicationRef).tick();

    expect(store.loading()).toBe(true);
    response.next(team);
    response.complete();
    await settle();

    expect(store.loading()).toBe(false);
    expect(store.employees()).toEqual(team);
    expect(store.failed()).toBe(false);
    expect(list).toHaveBeenCalledTimes(1);
  });

  it('reports a failure without data', async () => {
    const { store } = setup(() => throwError(() => new Error('boom')));
    await settle();

    expect(store.failed()).toBe(true);
    expect(store.employees()).toEqual([]);
  });

  it('can load again', async () => {
    const { store, list } = setup(() => of(team));
    await settle();

    store.reload();
    await settle();

    expect(list).toHaveBeenCalledTimes(2);
  });
});
