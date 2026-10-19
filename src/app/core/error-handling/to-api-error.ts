import { HttpErrorResponse } from '@angular/common/http';
import { API_ERROR_KIND, ApiError, ApiErrorKind } from '@core/http/api-error.model';
import { ProblemDetailDto } from '@core/http/problem-detail.dto';

const KIND_BY_STATUS: Readonly<Record<number, ApiErrorKind>> = {
  0: API_ERROR_KIND.network,
  400: API_ERROR_KIND.validation,
  401: API_ERROR_KIND.unauthorized,
  403: API_ERROR_KIND.forbidden,
  404: API_ERROR_KIND.notFound,
  409: API_ERROR_KIND.conflict,
};

/** Maps an HttpErrorResponse (ProblemDetail body) to the app-wide ApiError union. */
export function toApiError(error: HttpErrorResponse): ApiError {
  const body = asProblemDetail(error.error);
  const message = body?.detail ?? body?.title ?? null;
  const kind =
    KIND_BY_STATUS[error.status] ??
    (error.status >= 500 ? API_ERROR_KIND.server : API_ERROR_KIND.unknown);

  return { kind, status: error.status, message, fieldErrors: body?.errors ?? {} };
}

function asProblemDetail(body: unknown): ProblemDetailDto | null {
  return typeof body === 'object' && body !== null ? (body as ProblemDetailDto) : null;
}
