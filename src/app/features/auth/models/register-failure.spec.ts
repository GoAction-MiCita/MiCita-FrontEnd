import { ApiError } from '@core/http/api-error.model';
import { toRegisterFailure } from './register-failure';

function apiError(overrides: Partial<ApiError>): ApiError {
  return { kind: 'unknown', status: 0, message: null, fieldErrors: {}, ...overrides };
}

describe('toRegisterFailure', () => {
  it('passes 400 field errors through', () => {
    const failure = toRegisterFailure(
      apiError({ kind: 'validation', status: 400, fieldErrors: { phone: 'Formato inválido' } }),
    );

    expect(failure.fieldErrors).toEqual({ phone: 'Formato inválido' });
    expect(failure.summary).toContain('Revisa los campos');
  });

  it('marks the email on a 409 whose detail mentions the email', () => {
    const failure = toRegisterFailure(
      apiError({ kind: 'conflict', status: 409, message: 'Email already registered' }),
    );

    expect(failure.fieldErrors).toEqual({ email: 'Este correo ya está registrado' });
  });

  it('marks the username on a 409 whose errors map names it', () => {
    const failure = toRegisterFailure(
      apiError({ kind: 'conflict', status: 409, fieldErrors: { username: 'duplicated' } }),
    );

    expect(failure.fieldErrors).toEqual({ username: 'Este nombre de usuario ya está en uso' });
  });

  it('falls back to a generic message when the 409 field cannot be determined', () => {
    const failure = toRegisterFailure(
      apiError({ kind: 'conflict', status: 409, message: 'Email or username already exists' }),
    );

    expect(failure).toEqual({
      summary: 'El correo o el nombre de usuario ya están registrados.',
      fieldErrors: {},
    });
  });

  it('reports connection problems', () => {
    expect(toRegisterFailure(apiError({ kind: 'network' })).summary).toContain('conectar');
  });

  it('reports any other error as unexpected', () => {
    expect(toRegisterFailure(apiError({ kind: 'server', status: 500 })).summary).toContain(
      'inesperado',
    );
  });
});
