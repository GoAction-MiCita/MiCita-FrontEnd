import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ApiError } from '@core/http/api-error.model';
import { firstValueFrom, of, Subject, throwError } from 'rxjs';
import { AuthSession } from './auth-session';
import { SessionApi } from './session-api';
import { IssuedSession } from './session.model';
import { fakeJwt } from './testing/fake-jwt';
import { TokenStorage } from './token-storage';

const unauthorized: ApiError = {
  kind: 'unauthorized',
  status: 401,
  message: null,
  fieldErrors: {},
};

function issued(refreshToken: string | null = 'rt-1', hasBusiness = true): IssuedSession {
  return {
    accessToken: fakeJwt({ sub: 'ana', hasBusiness }),
    refreshToken,
    user: { username: 'ana', hasBusiness },
  };
}

function setup(api: Partial<Record<keyof SessionApi, unknown>>) {
  localStorage.clear();
  sessionStorage.clear();
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: SessionApi, useValue: api }],
  });
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  return {
    session: TestBed.inject(AuthSession),
    storage: TestBed.inject(TokenStorage),
    navigate,
  };
}

describe('AuthSession', () => {
  it('keeps the access token in memory and persists only the refresh token', async () => {
    const { session, storage } = setup({ login: () => of(issued('rt-1')) });

    const user = await firstValueFrom(
      session.login({ identifier: 'ana', password: 'Abc#12' }, false),
    );

    expect(user.hasBusiness).toBe(true);
    expect(session.isAuthenticated()).toBe(true);
    expect(session.accessToken()).toContain('.');
    expect(storage.readRefreshToken()).toBe('rt-1');
    expect(JSON.stringify({ ...sessionStorage })).not.toContain(session.accessToken());
  });

  it('shares a single refresh request between concurrent callers', async () => {
    const response = new Subject<IssuedSession>();
    const refresh = vi.fn(() => response.asObservable());
    const { session, storage } = setup({ refresh });
    storage.writeRefreshToken('rt-old', true);

    const first = firstValueFrom(session.refresh());
    const second = firstValueFrom(session.refresh());
    response.next(issued('rt-new'));
    response.complete();

    expect(await first).toBe(await second);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledWith('rt-old');
    expect(storage.readRefreshToken()).toBe('rt-new');
    expect(storage.isRemembered()).toBe(true);
  });

  it('keeps the previous refresh token when the backend does not rotate it', async () => {
    const { session, storage } = setup({ refresh: () => of(issued(null)) });
    storage.writeRefreshToken('rt-keep', false);

    await firstValueFrom(session.refresh());

    expect(storage.readRefreshToken()).toBe('rt-keep');
  });

  it('clears the session when the refresh token is rejected', async () => {
    const { session, storage } = setup({ refresh: () => throwError(() => unauthorized) });
    storage.writeRefreshToken('rt-bad', false);

    await expect(firstValueFrom(session.refresh())).rejects.toEqual(unauthorized);
    expect(storage.readRefreshToken()).toBeNull();
    expect(session.isAuthenticated()).toBe(false);
  });

  it('keeps the refresh token on network errors', async () => {
    const network: ApiError = { kind: 'network', status: 0, message: null, fieldErrors: {} };
    const { session, storage } = setup({ refresh: () => throwError(() => network) });
    storage.writeRefreshToken('rt-1', false);

    expect(await session.ensureSession()).toBe(false);
    expect(storage.readRefreshToken()).toBe('rt-1');
  });

  it('restores the session from the stored refresh token', async () => {
    const { session, storage } = setup({ refresh: () => of(issued()) });
    storage.writeRefreshToken('rt-1', false);

    expect(await session.ensureSession()).toBe(true);
    expect(session.user()?.username).toBe('ana');
  });

  it('reports no session when there is no refresh token', async () => {
    const refresh = vi.fn();
    const { session } = setup({ refresh });

    expect(await session.ensureSession()).toBe(false);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('revokes the refresh token, clears the session and goes to login on logout', async () => {
    const logout = vi.fn(() => of(undefined));
    const { session, storage, navigate } = setup({ login: () => of(issued('rt-1')), logout });
    await firstValueFrom(session.login({ identifier: 'ana', password: 'x' }, true));

    await session.logout();

    expect(logout).toHaveBeenCalledWith('rt-1');
    expect(session.isAuthenticated()).toBe(false);
    expect(storage.readRefreshToken()).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/auth/login']);
  });

  it('clears the local session even if the logout request fails', async () => {
    const { session, storage } = setup({
      login: () => of(issued('rt-1')),
      logout: () => throwError(() => unauthorized),
    });
    await firstValueFrom(session.login({ identifier: 'ana', password: 'x' }, false));

    await session.logout();

    expect(session.isAuthenticated()).toBe(false);
    expect(storage.readRefreshToken()).toBeNull();
  });

  it('markBusinessCreated() refreshes the token and flags the user as having a business', async () => {
    const refresh = vi.fn(() => of(issued('rt-2', false)));
    const { session } = setup({ login: () => of(issued('rt-1', false)), refresh });
    await firstValueFrom(session.login({ identifier: 'ana', password: 'x' }, false));

    await session.markBusinessCreated();

    expect(refresh).toHaveBeenCalledWith('rt-1');
    // The backend claim may lag behind: the local session is updated anyway.
    expect(session.user()?.hasBusiness).toBe(true);
    expect(session.isAuthenticated()).toBe(true);
  });

  it('markBusinessCreated() flags the user even if the refresh fails', async () => {
    const network: ApiError = { kind: 'network', status: 0, message: null, fieldErrors: {} };
    const { session } = setup({
      login: () => of(issued('rt-1', false)),
      refresh: () => throwError(() => network),
    });
    await firstValueFrom(session.login({ identifier: 'ana', password: 'x' }, false));

    await session.markBusinessCreated();

    expect(session.user()?.hasBusiness).toBe(true);
  });

  it('expire() clears the session and redirects to login flagged as expired', async () => {
    const { session, navigate } = setup({ login: () => of(issued()) });
    await firstValueFrom(session.login({ identifier: 'ana', password: 'x' }, false));

    await session.expire();

    expect(session.isAuthenticated()).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/auth/login'], { queryParams: { expired: true } });
  });
});
