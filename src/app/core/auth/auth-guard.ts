import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthSession, LOGIN_PATH } from './auth-session';

export const HOME_PATH = '/dashboard';

// inject() must run before the first await: the injection context does not survive it.

/** Private routes: restores the session if possible, otherwise sends the user to login. */
export const authGuard: CanActivateFn = async (_route, state) => {
  const session = inject(AuthSession);
  const router = inject(Router);
  if (await session.ensureSession()) {
    return true;
  }
  // The default home is not a real choice of the user: let the login decide it (onboarding vs
  // dashboard) instead of forcing it back through returnUrl.
  const queryParams = state.url === HOME_PATH ? {} : { returnUrl: state.url };
  return router.createUrlTree([LOGIN_PATH], { queryParams });
};

/** Public auth pages (login, register): an authenticated user goes straight to the app. */
export const guestGuard: CanActivateFn = async () => {
  const session = inject(AuthSession);
  const router = inject(Router);
  return (await session.ensureSession()) ? router.createUrlTree([HOME_PATH]) : true;
};
