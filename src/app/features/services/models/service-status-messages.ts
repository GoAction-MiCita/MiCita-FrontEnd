import { API_ERROR_KIND, ApiError } from '@core/http/api-error.model';
import { SERVICE_STATUS, ServiceStatus } from './service.model';

export const SERVICE_STATUS_MESSAGES = {
  activated: 'Servicio activado',
  // HU-11: deactivating never touches the appointments already booked.
  deactivated: 'Servicio desactivado. Sus citas existentes no se eliminan.',
  notFound: 'Este servicio ya no existe. No se cambió su estado.',
  businessRequired: 'Necesitas registrar tu negocio para gestionar servicios.',
  network: 'No pudimos conectar con el servidor. El estado del servicio no cambió.',
  unexpected: 'No pudimos cambiar el estado del servicio. Inténtalo de nuevo más tarde.',
} as const;

export function statusChangedMessage(status: ServiceStatus): string {
  return status === SERVICE_STATUS.active
    ? SERVICE_STATUS_MESSAGES.activated
    : SERVICE_STATUS_MESSAGES.deactivated;
}

/** What the user reads after a failed `PATCH /servicios/{id}/estado`; never server details. */
export function toServiceStatusFailureMessage(error: ApiError): string {
  switch (error.kind) {
    case API_ERROR_KIND.notFound:
      return SERVICE_STATUS_MESSAGES.notFound;
    case API_ERROR_KIND.forbidden:
      return SERVICE_STATUS_MESSAGES.businessRequired;
    case API_ERROR_KIND.network:
      return SERVICE_STATUS_MESSAGES.network;
    default:
      return SERVICE_STATUS_MESSAGES.unexpected;
  }
}
