import { ApiError, ApiErrorKind } from '@core/http/api-error.model';
import { SERVICES_ERROR_MESSAGES, toServicesLoadError } from './services-error';

function error(kind: ApiErrorKind, message: string | null = null): ApiError {
  return { kind, status: 0, message, fieldErrors: {} };
}

describe('toServicesLoadError', () => {
  it('explains a 403 (business required) without offering a retry', () => {
    expect(toServicesLoadError(error('forbidden'))).toEqual({
      message: SERVICES_ERROR_MESSAGES.businessRequired,
      retryable: false,
    });
  });

  it('offers a retry for network errors', () => {
    expect(toServicesLoadError(error('network'))).toEqual({
      message: SERVICES_ERROR_MESSAGES.network,
      retryable: true,
    });
  });

  it('never exposes server details', () => {
    const result = toServicesLoadError(error('server', 'NullPointerException at ServiceRepo:42'));

    expect(result.message).toBe(SERVICES_ERROR_MESSAGES.unexpected);
    expect(result.message).not.toContain('NullPointer');
  });
});
