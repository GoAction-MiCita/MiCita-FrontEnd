import { TestBed } from '@angular/core/testing';
import { ApiError } from '@core/http/api-error.model';
import { Subject, of, throwError } from 'rxjs';
import { NewUser, User } from '../models/user.model';
import { AuthApi } from './auth-api';
import { RegisterStore } from './register-store';

const newUser: NewUser = {
  firstName: 'Ana',
  lastName: 'López',
  address: 'Cra 25',
  phone: '3001234567',
  email: 'ana@correo.com',
  username: 'analopez',
  password: 'Abc#12',
};
const user: User = { id: '1', ...newUser };

function setup(register: AuthApi['register']) {
  TestBed.configureTestingModule({
    providers: [RegisterStore, { provide: AuthApi, useValue: { register } }],
  });
  return TestBed.inject(RegisterStore);
}

describe('RegisterStore', () => {
  it('stores the created user on success', async () => {
    const store = setup(() => of(user));

    expect(await store.register(newUser)).toBe(true);
    expect(store.user()).toEqual(user);
    expect(store.failure()).toBeNull();
    expect(store.pending()).toBe(false);
  });

  it('is pending while the request is in flight and ignores double submits', async () => {
    const response = new Subject<User>();
    const register = vi.fn(() => response.asObservable());
    const store = setup(register);

    const first = store.register(newUser);
    expect(store.pending()).toBe(true);
    expect(await store.register(newUser)).toBe(false);
    expect(register).toHaveBeenCalledTimes(1);

    response.next(user);
    response.complete();
    expect(await first).toBe(true);
  });

  it('exposes a failure built from the ApiError', async () => {
    const error: ApiError = {
      kind: 'conflict',
      status: 409,
      message: 'Username already exists',
      fieldErrors: {},
    };
    const store = setup(() => throwError(() => error));

    expect(await store.register(newUser)).toBe(false);
    expect(store.failure()?.fieldErrors).toEqual({
      username: 'Este nombre de usuario ya está en uso',
    });
  });

  it('treats non-ApiError failures as unexpected', async () => {
    const store = setup(() => throwError(() => new Error('boom')));

    await store.register(newUser);

    expect(store.failure()?.summary).toContain('inesperado');
  });
});
