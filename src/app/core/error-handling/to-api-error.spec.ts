import { HttpErrorResponse } from '@angular/common/http';
import { toApiError } from './to-api-error';

function httpError(status: number, error: unknown = null): HttpErrorResponse {
  return new HttpErrorResponse({ status, error });
}

describe('toApiError', () => {
  it('maps a 400 ProblemDetail to a validation error with field errors', () => {
    const result = toApiError(
      httpError(400, { title: 'Bad Request', errors: { email: 'Correo inválido' } }),
    );

    expect(result).toEqual({
      kind: 'validation',
      status: 400,
      message: 'Bad Request',
      fieldErrors: { email: 'Correo inválido' },
    });
  });

  it('maps 409 to a conflict error using detail as message', () => {
    const result = toApiError(httpError(409, { title: 'Conflict', detail: 'Email already used' }));

    expect(result).toEqual({ kind: 'conflict', status: 409, message: 'Email already used' });
  });

  it('maps status 0 to a network error', () => {
    expect(toApiError(httpError(0)).kind).toBe('network');
  });

  it('maps 5xx to a server error', () => {
    expect(toApiError(httpError(503)).kind).toBe('server');
  });

  it('defaults to empty field errors when a 400 has no body', () => {
    expect(toApiError(httpError(400))).toMatchObject({
      kind: 'validation',
      fieldErrors: {},
      message: null,
    });
  });
});
