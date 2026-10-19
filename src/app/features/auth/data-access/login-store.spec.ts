import { TestBed } from '@angular/core/testing';
import { AuthSession } from '@core/auth/auth-session';
import { SessionUser } from '@core/auth/session.model';
import { ApiError } from '@core/http/api-error.model';
import { of, Subject, throwError } from 'rxjs';
import { LoginStore } from './login-store';

const credentials = { identifier: 'ana', password: 'Abc#12' };
const user: SessionUser = { username: 'ana', hasBusiness: false };

function setup(login: AuthSession['login']) {
  TestBed.configureTestingModule({
    providers: [LoginStore, { provide: AuthSession, useValue: { login } }],
  });
  return TestBed.inject(LoginStore);
}

describe('LoginStore', () => {
  it('returns the user and passes the remember flag', async () => {
    const login = vi.fn(() => of(user));
    const store = setup(login);

    expect(await store.login(credentials, true)).toEqual(user);
    expect(login).toHaveBeenCalledWith(credentials, true);
    expect(store.failure()).toBeNull();
  });

  it('is pending while the request is in flight and ignores double submits', async () => {
    const response = new Subject<SessionUser>();
    const login = vi.fn(() => response.asObservable());
    const store = setup(login);

    const first = store.login(credentials, false);
    expect(store.pending()).toBe(true);
    expect(await store.login(credentials, false)).toBeNull();
    expect(login).toHaveBeenCalledTimes(1);

    response.next(user);
    response.complete();
    expect(await first).toEqual(user);
    expect(store.pending()).toBe(false);
  });

  it('shows a generic message on 401', async () => {
    const error: ApiError = { kind: 'unauthorized', status: 401, message: null, fieldErrors: {} };
    const store = setup(() => throwError(() => error));

    expect(await store.login(credentials, false)).toBeNull();
    expect(store.failure()).toBe('Credenciales no válidas');
  });
});
