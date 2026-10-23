import { API_ERROR_KIND, ApiError } from '@core/http/api-error.model';

/** Message shown when the services list cannot be loaded. */
export interface ServicesLoadError {
  readonly message: string;
  /** Whether retrying can help (a 403 for "business required" will not change by retrying). */
  readonly retryable: boolean;
}

export const SERVICES_ERROR_MESSAGES = {
  businessRequired: 'Necesitas registrar tu negocio para gestionar servicios.',
  network: 'No pudimos conectar con el servidor. Verifica tu conexión e inténtalo de nuevo.',
  unexpected: 'No pudimos cargar tus servicios. Inténtalo de nuevo.',
} as const;

export function toServicesLoadError(error: ApiError): ServicesLoadError {
  switch (error.kind) {
    case API_ERROR_KIND.forbidden:
      return { message: SERVICES_ERROR_MESSAGES.businessRequired, retryable: false };
    case API_ERROR_KIND.network:
      return { message: SERVICES_ERROR_MESSAGES.network, retryable: true };
    default:
      // Server details are never shown to the user.
      return { message: SERVICES_ERROR_MESSAGES.unexpected, retryable: true };
  }
}
