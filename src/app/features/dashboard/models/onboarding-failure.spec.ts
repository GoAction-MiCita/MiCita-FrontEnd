import { ApiError } from '@core/http/api-error.model';
import { toOnboardingFailure } from './onboarding-failure';

function apiError(overrides: Partial<ApiError>): ApiError {
  return { kind: 'unknown', status: 0, message: null, fieldErrors: {}, ...overrides };
}

describe('toOnboardingFailure', () => {
  it('passes 400 field errors through', () => {
    const failure = toOnboardingFailure(
      apiError({ kind: 'validation', status: 400, fieldErrors: { phone: 'Teléfono inválido' } }),
    );

    expect(failure).toEqual({
      title: 'No pudimos registrar tu negocio',
      summary: 'Revisa los campos marcados e inténtalo de nuevo.',
      fieldErrors: { phone: 'Teléfono inválido' },
    });
  });

  it('marks the NIT when the 409 is about a duplicated NIT', () => {
    const failure = toOnboardingFailure(
      apiError({ kind: 'conflict', status: 409, message: 'NIT already registered' }),
    );

    expect(failure.title).toBe('Este negocio ya está registrado');
    expect(failure.fieldErrors).toEqual({ nit: 'Este NIT ya está registrado' });
  });

  it('explains a 409 for a user that already has a business', () => {
    const failure = toOnboardingFailure(
      apiError({ kind: 'conflict', status: 409, message: 'User already has a business' }),
    );

    expect(failure.summary).toBe('Tu cuenta ya tiene un negocio registrado.');
    expect(failure.fieldErrors).toEqual({});
  });

  it('reports connection problems and unexpected errors', () => {
    expect(toOnboardingFailure(apiError({ kind: 'network' })).summary).toContain('conectar');
    expect(toOnboardingFailure(apiError({ kind: 'server' })).summary).toContain('inesperado');
  });
});
