import { ApiError, ApiErrorKind } from '@core/http/api-error.model';
import { LOGIN_FAILURE_MESSAGES, toLoginFailure } from './login-failure';

function error(kind: ApiErrorKind): ApiError {
  return { kind, status: 0, message: 'Bad credentials for user ana', fieldErrors: {} };
}

describe('toLoginFailure', () => {
  it.each<ApiErrorKind>(['unauthorized', 'validation'])(
    'returns a generic credentials message for %s',
    (kind) => {
      expect(toLoginFailure(error(kind))).toBe('Credenciales no válidas');
    },
  );

  it('reports connection problems', () => {
    expect(toLoginFailure(error('network'))).toBe(LOGIN_FAILURE_MESSAGES.network);
  });

  it('reports any other error as unexpected', () => {
    expect(toLoginFailure(error('server'))).toBe(LOGIN_FAILURE_MESSAGES.unexpected);
  });
});
