import { API_ERROR_KIND, ApiError } from '@core/http/api-error.model';

export const LOGIN_FAILURE_MESSAGES = {
  // Same text for wrong user and wrong password: never reveal which one failed.
  invalidCredentials: 'Credenciales no válidas',
  network: 'No pudimos conectar con el servidor. Verifica tu conexión e inténtalo de nuevo.',
  unexpected: 'Ocurrió un error inesperado. Inténtalo de nuevo más tarde.',
} as const;

export function toLoginFailure(error: ApiError): string {
  switch (error.kind) {
    case API_ERROR_KIND.unauthorized:
    case API_ERROR_KIND.validation:
      return LOGIN_FAILURE_MESSAGES.invalidCredentials;
    case API_ERROR_KIND.network:
      return LOGIN_FAILURE_MESSAGES.network;
    default:
      return LOGIN_FAILURE_MESSAGES.unexpected;
  }
}
