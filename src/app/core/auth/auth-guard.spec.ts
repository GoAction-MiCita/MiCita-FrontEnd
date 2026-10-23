import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  provideRouter,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { authGuard, guestGuard } from './auth-guard';
import { AuthSession } from './auth-session';

function setup(hasSession: boolean) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AuthSession, useValue: { ensureSession: () => Promise.resolve(hasSession) } },
    ],
  });
}

function run(guard: typeof authGuard, url = '/dashboard') {
  return TestBed.runInInjectionContext(() =>
    guard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
  ) as Promise<boolean | UrlTree>;
}

describe('authGuard', () => {
  it('lets an authenticated user in', async () => {
    setup(true);

    expect(await run(authGuard)).toBe(true);
  });

  it('redirects to login keeping the requested url', async () => {
    setup(false);

    const result = await run(authGuard, '/settings?tab=2');

    expect(String(result)).toBe('/auth/login?returnUrl=%2Fsettings%3Ftab%3D2');
  });

  it('does not keep the default home as returnUrl', async () => {
    setup(false);

    expect(String(await run(authGuard, '/dashboard'))).toBe('/auth/login');
  });
});

describe('guestGuard', () => {
  it('lets a visitor see the auth pages', async () => {
    setup(false);

    expect(await run(guestGuard)).toBe(true);
  });

  it('sends an authenticated user to the dashboard', async () => {
    setup(true);

    expect(String(await run(guestGuard))).toBe('/dashboard');
  });
});
