import { ApiError } from '@core/http/api-error.model';
import { EMPLOYEES_ERROR_MESSAGES, toEmployeesLoadError } from './employees-error';

const error = (kind: ApiError['kind'], message: string | null = null): ApiError => ({
  kind,
  status: 0,
  message,
  fieldErrors: {},
});

describe('toEmployeesLoadError', () => {
  it('marks a 403 as "business required", without retry', () => {
    expect(toEmployeesLoadError(error('forbidden'))).toEqual({
      message: EMPLOYEES_ERROR_MESSAGES.businessRequired,
      retryable: false,
      businessRequired: true,
      invalidFilter: false,
    });
  });

  it('offers a retry on network errors', () => {
    expect(toEmployeesLoadError(error('network'))).toEqual({
      message: EMPLOYEES_ERROR_MESSAGES.network,
      retryable: true,
      businessRequired: false,
      invalidFilter: false,
    });
  });

  it('never shows server details', () => {
    expect(toEmployeesLoadError(error('server', 'NullPointerException at ...'))).toEqual({
      message: EMPLOYEES_ERROR_MESSAGES.unexpected,
      retryable: true,
      businessRequired: false,
      invalidFilter: false,
    });
  });

  it('marks a 400 on serviceIds as a rejected filter (HU-22), without retry', () => {
    expect(
      toEmployeesLoadError({
        ...error('validation', 'detalle'),
        fieldErrors: { 'serviceIds[1]': 'El servicio no pertenece al negocio' },
      }),
    ).toEqual({
      message: EMPLOYEES_ERROR_MESSAGES.invalidServiceFilter,
      retryable: false,
      businessRequired: false,
      invalidFilter: true,
    });
  });

  it('treats any other 400 as an unexpected, retryable error', () => {
    expect(
      toEmployeesLoadError({ ...error('validation'), fieldErrors: { size: 'Fuera de rango' } }),
    ).toEqual({
      message: EMPLOYEES_ERROR_MESSAGES.unexpected,
      retryable: true,
      businessRequired: false,
      invalidFilter: false,
    });
    expect(toEmployeesLoadError(error('validation')).invalidFilter).toBe(false);
  });
});
