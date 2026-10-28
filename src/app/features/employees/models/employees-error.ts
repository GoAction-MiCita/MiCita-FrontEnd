import { API_ERROR_KIND, ApiError } from '@core/http/api-error.model';

/** Message shown when the employees list cannot be loaded. */
export interface EmployeesLoadError {
  readonly message: string;
  /** Whether retrying can help (a 403 for "business required" will not change by retrying). */
  readonly retryable: boolean;
  /** 403: the user has no business yet; the page sends them to the onboarding. */
  readonly businessRequired: boolean;
  /** HU-22: 400 on `serviceIds`, the backend rejected a service of the filter. */
  readonly invalidFilter: boolean;
}

export const EMPLOYEES_ERROR_MESSAGES = {
  businessRequired: 'Necesitas registrar tu negocio para gestionar empleados.',
  network: 'No pudimos conectar con el servidor. Verifica tu conexión e inténtalo de nuevo.',
  unexpected: 'No pudimos cargar tus empleados. Inténtalo de nuevo.',
  invalidServiceFilter:
    'Uno de los servicios del filtro ya no está disponible. Quitamos el filtro de servicios.',
} as const;

export function toEmployeesLoadError(error: ApiError): EmployeesLoadError {
  switch (error.kind) {
    case API_ERROR_KIND.forbidden:
      return {
        message: EMPLOYEES_ERROR_MESSAGES.businessRequired,
        retryable: false,
        businessRequired: true,
        invalidFilter: false,
      };
    case API_ERROR_KIND.validation:
      // HU-22 Back: a foreign or deleted service comes as errors["serviceIds[i]"]; any other 400
      // is not about the services filter and is shown as an unexpected, retryable error.
      if (Object.keys(error.fieldErrors).some((field) => field.startsWith('serviceIds'))) {
        return {
          message: EMPLOYEES_ERROR_MESSAGES.invalidServiceFilter,
          retryable: false,
          businessRequired: false,
          invalidFilter: true,
        };
      }
      return {
        message: EMPLOYEES_ERROR_MESSAGES.unexpected,
        retryable: true,
        businessRequired: false,
        invalidFilter: false,
      };
    case API_ERROR_KIND.network:
      return {
        message: EMPLOYEES_ERROR_MESSAGES.network,
        retryable: true,
        businessRequired: false,
        invalidFilter: false,
      };
    default:
      // Server details are never shown to the user.
      return {
        message: EMPLOYEES_ERROR_MESSAGES.unexpected,
        retryable: true,
        businessRequired: false,
        invalidFilter: false,
      };
  }
}
