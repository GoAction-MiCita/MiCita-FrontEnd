import { API_ERROR_KIND, ApiError } from '@core/http/api-error.model';

/** What the "Eliminar servicio" dialog shows after a failed `DELETE /servicios/{id}`. */
export interface DeleteServiceFailure {
  readonly title: string;
  readonly summary: string;
  /** 409: deleting is not possible (future appointments); the dialog only offers to close. */
  readonly blocked: boolean;
}

export const DELETE_SERVICE_MESSAGES = {
  title: 'No pudimos eliminar el servicio',
  blockedTitle: 'No puedes eliminar este servicio',
  businessRequired: 'Necesitas registrar tu negocio para gestionar servicios.',
  network: 'No pudimos conectar con el servidor. Verifica tu conexión e inténtalo de nuevo.',
  unexpected: 'Ocurrió un error inesperado. Inténtalo de nuevo más tarde.',
} as const;

/** HU-14 Back: the only 409 means the service still has future appointments. */
export function futureAppointmentsMessage(serviceName: string): string {
  return `«${serviceName}» tiene citas futuras. Puedes desactivarlo en su lugar.`;
}

export function toDeleteServiceFailure(error: ApiError, serviceName: string): DeleteServiceFailure {
  switch (error.kind) {
    case API_ERROR_KIND.conflict:
      return {
        title: DELETE_SERVICE_MESSAGES.blockedTitle,
        summary: futureAppointmentsMessage(serviceName),
        blocked: true,
      };
    case API_ERROR_KIND.forbidden:
      return failure(DELETE_SERVICE_MESSAGES.businessRequired);
    case API_ERROR_KIND.network:
      return failure(DELETE_SERVICE_MESSAGES.network);
    default:
      // Server details are never shown to the user.
      return failure(DELETE_SERVICE_MESSAGES.unexpected);
  }
}

function failure(summary: string): DeleteServiceFailure {
  return { title: DELETE_SERVICE_MESSAGES.title, summary, blocked: false };
}
