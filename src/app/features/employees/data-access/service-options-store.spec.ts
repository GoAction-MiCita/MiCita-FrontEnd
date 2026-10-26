import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ApiError } from '@core/http/api-error.model';
import { of, throwError } from 'rxjs';
import { ServiceOption } from '../models/employee.model';
import { ServiceOptionsApi } from './service-options-api';
import { ServiceOptionsStore } from './service-options-store';

const services: ServiceOption[] = [{ id: 's1', name: 'Corte', active: true }];
const networkError: ApiError = { kind: 'network', status: 0, message: null, fieldErrors: {} };

function setup(fail = () => false) {
  const list = vi.fn(() => (fail() ? throwError(() => networkError) : of(services)));
  TestBed.configureTestingModule({
    providers: [ServiceOptionsStore, { provide: ServiceOptionsApi, useValue: { list } }],
  });
  return { store: TestBed.inject(ServiceOptionsStore), list };
}

const settle = () => TestBed.inject(ApplicationRef).whenStable();

describe('ServiceOptionsStore', () => {
  it('does not fetch until load() and then only once', async () => {
    const { store, list } = setup();
    await settle();
    expect(list).not.toHaveBeenCalled();

    store.load();
    await settle();
    store.load();
    await settle();

    expect(list).toHaveBeenCalledTimes(1);
    expect(store.services()).toEqual(services);
  });

  it('reports a failure and retries on the next load()', async () => {
    let failing = true;
    const { store, list } = setup(() => failing);
    store.load();
    await settle();
    expect(store.failed()).toBe(true);

    failing = false;
    store.load();
    await settle();

    expect(list).toHaveBeenCalledTimes(2);
    expect(store.failed()).toBe(false);
    expect(store.services()).toEqual(services);
  });
});
