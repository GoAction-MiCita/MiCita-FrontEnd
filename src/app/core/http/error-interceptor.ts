import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { toApiError } from '@core/error-handling/to-api-error';
import { catchError, throwError } from 'rxjs';

/** Rethrows every HTTP failure as an ApiError so stores never deal with HttpErrorResponse. */
export const errorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((error: unknown) =>
      throwError(() => (error instanceof HttpErrorResponse ? toApiError(error) : error)),
    ),
  );
