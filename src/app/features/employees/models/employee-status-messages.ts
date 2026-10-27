import { API_ERROR_KIND, ApiError } from '@core/http/api-error.model';
import { EMPLOYEE_STATUS, EmployeeStatus } from './employee.model';

export const EMPLOYEE_STATUS_MESSAGES = {
  activated: 'Empleado activado',
  // HU-20: an inactive employee is not offered for new appointments; booked ones stay as they are.
  deactivated: 'Empleado desactivado. No recibirá nuevas citas y las existentes no cambian.',
  notFound: 'Este empleado ya no existe. No se cambió su estado.',
  businessRequired: 'Necesitas registrar tu negocio para gestionar empleados.',
  network: 'No pudimos conectar con el servidor. El estado del empleado no cambió.',
  unexpected: 'No pudimos cambiar el estado del empleado. Inténtalo de nuevo más tarde.',
} as const;

export function employeeStatusChangedMessage(status: EmployeeStatus): string {
  return status === EMPLOYEE_STATUS.active
    ? EMPLOYEE_STATUS_MESSAGES.activated
    : EMPLOYEE_STATUS_MESSAGES.deactivated;
}

/** What the user reads after a failed `PATCH /empleados/{id}/estado`; never server details. */
export function toEmployeeStatusFailureMessage(error: ApiError): string {
  switch (error.kind) {
    case API_ERROR_KIND.notFound:
      return EMPLOYEE_STATUS_MESSAGES.notFound;
    case API_ERROR_KIND.forbidden:
      return EMPLOYEE_STATUS_MESSAGES.businessRequired;
    case API_ERROR_KIND.network:
      return EMPLOYEE_STATUS_MESSAGES.network;
    default:
      return EMPLOYEE_STATUS_MESSAGES.unexpected;
  }
}
