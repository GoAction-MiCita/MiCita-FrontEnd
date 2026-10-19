import { HttpContextToken, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthSession } from '@core/auth/auth-session';
import { PUBLIC_AUTH_PATHS } from '@core/auth/session-api';
import { API_URL } from '@core/config/api-url';
import { Notifier } from '@core/notifications/notifier';
import { catchError, switchMap, throwError } from 'rxjs';
import { API_ERROR_KIND, isApiError } from './api-error.model';

/** Marks a request already retried after a refresh, so it is retried only once. */
const RETRIED_AFTER_REFRESH = new HttpContextToken<boolean>(() => false);

export const FORBIDDEN_MESSAGE = 'No tienes permisos para realizar esta acción.';

/**
 * Adds the Bearer token to API requests. On 401 it refreshes the access token (one shared
 * request for concurrent failures) and retries the original request once; if the refresh token
 * is rejected the session expires. On 403 it shows the permissions error.
 * Must run before errorInterceptor so it receives ApiError values.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const apiUrl = inject(API_URL);
  if (!req.url.startsWith(apiUrl)) {
    return next(req);
  }
  const session = inject(AuthSession);
  const notifier = inject(Notifier);
  const isPublic = PUBLIC_AUTH_PATHS.some((path) => req.url.startsWith(`${apiUrl}${path}`));

  return next(withToken(req, session.accessToken())).pipe(
    catchError((error: unknown) => {
      if (!isApiError(error)) {
        return throwError(() => error);
      }
      if (error.kind === API_ERROR_KIND.forbidden) {
        notifier.error(FORBIDDEN_MESSAGE);
      }
      const canRefresh =
        error.kind === API_ERROR_KIND.unauthorized &&
        !isPublic &&
        !req.context.get(RETRIED_AFTER_REFRESH);
      if (!canRefresh) {
        return throwError(() => error);
      }
      return session.refresh().pipe(
        catchError((refreshError: unknown) => {
          if (isApiError(refreshError) && refreshError.kind === API_ERROR_KIND.unauthorized) {
            void session.expire();
          }
          return throwError(() => error);
        }),
        switchMap((accessToken) =>
          next(
            withToken(
              req.clone({ context: req.context.set(RETRIED_AFTER_REFRESH, true) }),
              accessToken,
            ),
          ),
        ),
      );
    }),
  );
};

function withToken<T>(req: HttpRequest<T>, accessToken: string | null): HttpRequest<T> {
  return accessToken ? req.clone({ setHeaders: { Authorization: `Bearer ${accessToken}` } }) : req;
}
