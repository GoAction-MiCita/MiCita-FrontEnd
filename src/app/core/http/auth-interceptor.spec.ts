import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthSession } from '@core/auth/auth-session';
import { fakeJwt } from '@core/auth/testing/fake-jwt';
import { TokenStorage } from '@core/auth/token-storage';
import { API_URL } from '@core/config/api-url';
import { Notifier } from '@core/notifications/notifier';
import { firstValueFrom } from 'rxjs';
import { authInterceptor, FORBIDDEN_MESSAGE } from './auth-interceptor';
import { errorInterceptor } from './error-interceptor';

const API = 'http://api.test/api';
const oldToken = fakeJwt({ sub: 'ana', v: 1 });
const newToken = fakeJwt({ sub: 'ana', v: 2 });

function unauthorized() {
  return { status: 401, statusText: 'Unauthorized' };
}

async function setup({ loggedIn = true } = {}) {
  localStorage.clear();
  sessionStorage.clear();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
      provideHttpClientTesting(),
      { provide: API_URL, useValue: API },
    ],
  });
  const http = TestBed.inject(HttpClient);
  const backend = TestBed.inject(HttpTestingController);
  const session = TestBed.inject(AuthSession);
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

  if (loggedIn) {
    const login = firstValueFrom(session.login({ identifier: 'ana', password: 'x' }, false));
    backend.expectOne(`${API}/auth/login`).flush({ accessToken: oldToken, refreshToken: 'rt-1' });
    await login;
  }
  return { http, backend, session, navigate };
}

describe('authInterceptor', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('adds the Bearer token to API requests only', async () => {
    const { http, backend } = await setup();

    http.get(`${API}/businesses`).subscribe();
    http.get('https://cdn.example.com/x.json').subscribe();

    expect(backend.expectOne(`${API}/businesses`).request.headers.get('Authorization')).toBe(
      `Bearer ${oldToken}`,
    );
    expect(
      backend.expectOne('https://cdn.example.com/x.json').request.headers.has('Authorization'),
    ).toBe(false);
  });

  it('refreshes on 401 and retries the original request once with the new token', async () => {
    const { http, backend } = await setup();

    const result = firstValueFrom(http.get(`${API}/businesses`));
    backend.expectOne(`${API}/businesses`).flush(null, unauthorized());

    const refresh = backend.expectOne(`${API}/auth/refresh`);
    expect(refresh.request.body).toEqual({ refreshToken: 'rt-1' });
    refresh.flush({ accessToken: newToken, refreshToken: 'rt-2' });

    const retry = backend.expectOne(`${API}/businesses`);
    expect(retry.request.headers.get('Authorization')).toBe(`Bearer ${newToken}`);
    retry.flush({ ok: true });

    expect(await result).toEqual({ ok: true });
    expect(TestBed.inject(TokenStorage).readRefreshToken()).toBe('rt-2');
  });

  it('queues concurrent 401s behind a single refresh', async () => {
    const { http, backend } = await setup();

    const a = firstValueFrom(http.get(`${API}/a`));
    const b = firstValueFrom(http.get(`${API}/b`));
    backend.expectOne(`${API}/a`).flush(null, unauthorized());
    backend.expectOne(`${API}/b`).flush(null, unauthorized());

    backend.expectOne(`${API}/auth/refresh`).flush({ accessToken: newToken });
    backend.expectOne(`${API}/a`).flush('A');
    backend.expectOne(`${API}/b`).flush('B');

    expect([await a, await b]).toEqual(['A', 'B']);
  });

  it('does not retry more than once', async () => {
    const { http, backend } = await setup();

    const result = firstValueFrom(http.get(`${API}/businesses`));
    backend.expectOne(`${API}/businesses`).flush(null, unauthorized());
    backend.expectOne(`${API}/auth/refresh`).flush({ accessToken: newToken });
    backend.expectOne(`${API}/businesses`).flush(null, unauthorized());

    await expect(result).rejects.toMatchObject({ kind: 'unauthorized' });
    backend.expectNone(`${API}/auth/refresh`);
  });

  it('expires the session when the refresh token is rejected', async () => {
    const { http, backend, session, navigate } = await setup();

    const result = firstValueFrom(http.get(`${API}/businesses`));
    backend.expectOne(`${API}/businesses`).flush(null, unauthorized());
    backend.expectOne(`${API}/auth/refresh`).flush(null, unauthorized());

    await expect(result).rejects.toMatchObject({ kind: 'unauthorized' });
    expect(session.isAuthenticated()).toBe(false);
    expect(TestBed.inject(TokenStorage).readRefreshToken()).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/auth/login'], { queryParams: { expired: true } });
  });

  it('never refreshes on a failed login', async () => {
    const { http, backend } = await setup({ loggedIn: false });

    const result = firstValueFrom(http.post(`${API}/auth/login`, {}));
    backend.expectOne(`${API}/auth/login`).flush(null, unauthorized());

    await expect(result).rejects.toMatchObject({ kind: 'unauthorized' });
    backend.expectNone(`${API}/auth/refresh`);
  });

  it('shows the permissions error on 403', async () => {
    const { http, backend } = await setup();
    const notifier = TestBed.inject(Notifier);

    const result = firstValueFrom(http.get(`${API}/admin`));
    backend.expectOne(`${API}/admin`).flush(null, { status: 403, statusText: 'Forbidden' });

    await expect(result).rejects.toMatchObject({ kind: 'forbidden' });
    expect(notifier.notice()?.message).toBe(FORBIDDEN_MESSAGE);
    notifier.dismiss();
  });

  it('does not refresh for 401s from other hosts', async () => {
    const { http, backend } = await setup();

    const result = firstValueFrom(http.get('https://cdn.example.com/x.json'));
    backend.expectOne('https://cdn.example.com/x.json').flush(null, unauthorized());

    await expect(result).rejects.toMatchObject({ kind: 'unauthorized' });
    backend.expectNone(`${API}/auth/refresh`);
  });
});
