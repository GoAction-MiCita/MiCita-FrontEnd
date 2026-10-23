import { TestBed } from '@angular/core/testing';
import { AuthSession } from '@core/auth/auth-session';
import { ApiError } from '@core/http/api-error.model';
import { Observable, of, Subject, throwError } from 'rxjs';
import { Business, NewBusiness } from '../models/business.model';
import { BusinessApi } from './business-api';
import { OnboardingStore } from './onboarding-store';

const newBusiness: NewBusiness = {
  name: 'Barbería El Estilo',
  address: 'Cra 25',
  phone: '3001234567',
  nit: null,
  email: null,
};
const business: Business = {
  id: 'b1',
  ...newBusiness,
  status: 'ACTIVE',
  timeZone: 'America/Bogota',
};

function setup(createOnboarding: () => Observable<Business>) {
  const session = {
    markBusinessCreated: vi.fn(() => Promise.resolve()),
    expire: vi.fn(() => Promise.resolve()),
  };
  TestBed.configureTestingModule({
    providers: [
      OnboardingStore,
      { provide: BusinessApi, useValue: { createOnboarding: vi.fn(createOnboarding) } },
      { provide: AuthSession, useValue: session },
    ],
  });
  return { store: TestBed.inject(OnboardingStore), session };
}

function error(kind: ApiError['kind'], status: number): ApiError {
  return { kind, status, message: null, fieldErrors: {} };
}

describe('OnboardingStore', () => {
  it('creates the business and updates the session', async () => {
    const { store, session } = setup(() => of(business));

    expect(await store.createBusiness(newBusiness)).toBe(true);
    expect(session.markBusinessCreated).toHaveBeenCalledTimes(1);
    expect(store.failure()).toBeNull();
  });

  it('is pending while the request is in flight and ignores double submits', async () => {
    const response = new Subject<Business>();
    const { store } = setup(() => response.asObservable());

    const first = store.createBusiness(newBusiness);
    expect(store.pending()).toBe(true);
    expect(await store.createBusiness(newBusiness)).toBe(false);

    response.next(business);
    response.complete();
    expect(await first).toBe(true);
    expect(store.pending()).toBe(false);
  });

  it('keeps a failure for 400 and 409 without touching the session', async () => {
    const { store, session } = setup(() => throwError(() => error('conflict', 409)));

    expect(await store.createBusiness(newBusiness)).toBe(false);
    expect(store.failure()?.title).toBe('Este negocio ya está registrado');
    expect(session.markBusinessCreated).not.toHaveBeenCalled();
    expect(session.expire).not.toHaveBeenCalled();
  });

  it('ends the session on 401', async () => {
    const { store, session } = setup(() => throwError(() => error('unauthorized', 401)));

    expect(await store.createBusiness(newBusiness)).toBe(false);
    expect(session.expire).toHaveBeenCalledTimes(1);
    expect(store.failure()).toBeNull();
  });
});
