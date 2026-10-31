import { ApiError } from '@core/http/api-error.model';
import { toRegisterFailure } from './register-failure';

function apiError(overrides: Partial<ApiError>): ApiError {
  return { kind: 'unknown', status: 0, message: null, fieldErrors: {}, ...overrides };
}

describe('toRegisterFailure', () => {
  it('replaces the English 400 field messages of the backend with Spanish ones', () => {
    const failure = toRegisterFailure(
      apiError({
        kind: 'validation',
        status: 400,
        fieldErrors: {
          firstName: 'must not be blank',
          phone: 'must have 7 to 15 digits, optionally starting with +',
          password: 'must have at least 6 characters, including lowercase, uppercase and special',
        },
      }),
    );

    expect(failure.fieldErrors).toEqual({
      firstName: 'Ingresa un nombre válido (máximo 100 caracteres)',
      phone: 'Ingresa un teléfono válido (7 a 15 dígitos)',
      password: 'La contraseña no cumple las reglas de seguridad',
    });
    expect(failure.summary).toContain('Revisa los campos');
  });

  it('keeps the server message of a 400 field the form does not know', () => {
    const failure = toRegisterFailure(
      apiError({ kind: 'validation', status: 400, fieldErrors: { other: 'invalid' } }),
    );

    expect(failure.fieldErrors).toEqual({ other: 'invalid' });
  });

  it('marks the username on the backend 409 for a duplicated username', () => {
    const failure = toRegisterFailure(
      apiError({ kind: 'conflict', status: 409, message: 'Username is already registered' }),
    );

    expect(failure.fieldErrors).toEqual({ username: 'Este nombre de usuario ya está en uso' });
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
