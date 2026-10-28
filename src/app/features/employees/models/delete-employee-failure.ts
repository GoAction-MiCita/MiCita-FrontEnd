import { API_ERROR_KIND, ApiError } from '@core/http/api-error.model';
import { EMPLOYEE_STATUS, Employee } from './employee.model';

/** What the "Eliminar empleado" dialog shows after a failed `DELETE /empleados/{id}`. */
export interface DeleteEmployeeFailure {
  readonly title: string;
  readonly summary: string;
  /** 409: deleting is not possible (future appointments); the dialog offers to deactivate. */
  readonly blocked: boolean;
}

export const DELETE_EMPLOYEE_MESSAGES = {
  title: 'No pudimos eliminar el empleado',
  blockedTitle: 'No puedes eliminar este empleado',
  businessRequired: 'Necesitas registrar tu negocio para gestionar empleados.',
  network: 'No pudimos conectar con el servidor. Verifica tu conexión e inténtalo de nuevo.',
  unexpected: 'Ocurrió un error inesperado. Inténtalo de nuevo más tarde.',
} as const;

/**
 * HU-21 Back: the only 409 means the employee still has future appointments. The count travels
 * in the ProblemDetail but ApiError does not carry it, so the message goes without it.
 */
export function futureAppointmentsMessage(employee: Employee): string {
  return employee.status === EMPLOYEE_STATUS.active
    ? `«${employee.fullName}» tiene citas futuras. Puedes desactivarlo para que no reciba nuevas citas.`
    : `«${employee.fullName}» tiene citas futuras. Ya está inactivo, así que no recibirá nuevas citas.`;
}

export function toDeleteEmployeeFailure(
  error: ApiError,
  employee: Employee,
): DeleteEmployeeFailure {
  switch (error.kind) {
    case API_ERROR_KIND.conflict:
      return {
        title: DELETE_EMPLOYEE_MESSAGES.blockedTitle,
        summary: futureAppointmentsMessage(employee),
        blocked: true,
      };
    case API_ERROR_KIND.forbidden:
      return failure(DELETE_EMPLOYEE_MESSAGES.businessRequired);
    case API_ERROR_KIND.network:
      return failure(DELETE_EMPLOYEE_MESSAGES.network);
    default:
      // Server details are never shown to the user.
      return failure(DELETE_EMPLOYEE_MESSAGES.unexpected);
  }
}

function failure(summary: string): DeleteEmployeeFailure {
  return { title: DELETE_EMPLOYEE_MESSAGES.title, summary, blocked: false };
}
