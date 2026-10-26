import { API_ERROR_KIND, ApiError } from '@core/http/api-error.model';

/** Message shown when the employees list cannot be loaded. */
export interface EmployeesLoadError {
  readonly message: string;
  /** Whether retrying can help (a 403 for "business required" will not change by retrying). */
  readonly retryable: boolean;
  /** 403: the user has no business yet; the page sends them to the onboarding. */
  readonly businessRequired: boolean;
}

export const EMPLOYEES_ERROR_MESSAGES = {
  businessRequired: 'Necesitas registrar tu negocio para gestionar empleados.',
  network: 'No pudimos conectar con el servidor. Verifica tu conexión e inténtalo de nuevo.',
  unexpected: 'No pudimos cargar tus empleados. Inténtalo de nuevo.',
} as const;

export function toEmployeesLoadError(error: ApiError): EmployeesLoadError {
  switch (error.kind) {
    case API_ERROR_KIND.forbidden:
      return {
        message: EMPLOYEES_ERROR_MESSAGES.businessRequired,
        retryable: false,
        businessRequired: true,
      };
    case API_ERROR_KIND.network:
      return {
        message: EMPLOYEES_ERROR_MESSAGES.network,
        retryable: true,
        businessRequired: false,
      };
    default:
      // Server details are never shown to the user.
      return {
        message: EMPLOYEES_ERROR_MESSAGES.unexpected,
        retryable: true,
        businessRequired: false,
      };
  }
}
