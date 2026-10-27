import { API_ERROR_KIND, ApiError } from '@core/http/api-error.model';
import { FieldErrors } from '@shared/models/field-errors.model';
import { toNewEmployeeFieldErrors, toRejectedServiceIds } from './employee.mapper';

/** What the employee panel shows after a failed `POST /empleados`, `GET` or `PUT /empleados/{id}`. */
export interface EmployeeFormFailure {
  readonly title: string;
  readonly summary: string;
  /** Errors to attach to form controls (form field → message). */
  readonly fieldErrors: FieldErrors;
  /** Services the backend rejected (400), marked in the picker. */
  readonly rejectedServiceIds?: readonly string[];
}

export const EMPLOYEE_FORM_MESSAGES = {
  title: 'No pudimos crear el empleado',
  updateTitle: 'No pudimos guardar los cambios',
  loadTitle: 'No pudimos cargar el empleado',
  checkFields: 'Revisa los campos marcados e inténtalo de nuevo.',
  duplicate: 'Ya tienes un empleado con ese correo o teléfono.',
  duplicateEmail: 'Ya existe un empleado con este correo',
  duplicatePhone: 'Ya existe un empleado con este teléfono',
  businessRequired: 'Necesitas registrar tu negocio para gestionar empleados.',
  network: 'No pudimos conectar con el servidor. Verifica tu conexión e inténtalo de nuevo.',
  unexpected: 'Ocurrió un error inesperado. Inténtalo de nuevo más tarde.',
} as const;

/** `sentServiceIds`: the list sent, to turn `serviceIds[i]` errors into service ids. */
export function toEmployeeFormFailure(
  error: ApiError,
  sentServiceIds: readonly string[] = [],
  title: string = EMPLOYEE_FORM_MESSAGES.title,
): EmployeeFormFailure {
  switch (error.kind) {
    case API_ERROR_KIND.validation:
      return {
        title,
        summary: EMPLOYEE_FORM_MESSAGES.checkFields,
        fieldErrors: toNewEmployeeFieldErrors(error.fieldErrors),
        rejectedServiceIds: toRejectedServiceIds(error.fieldErrors, sentServiceIds),
      };
    case API_ERROR_KIND.conflict:
      return { title, summary: EMPLOYEE_FORM_MESSAGES.duplicate, fieldErrors: duplicates(error) };
    case API_ERROR_KIND.forbidden:
      return { title, summary: EMPLOYEE_FORM_MESSAGES.businessRequired, fieldErrors: {} };
    case API_ERROR_KIND.network:
      return { title, summary: EMPLOYEE_FORM_MESSAGES.network, fieldErrors: {} };
    default:
      // Server details are never shown to the user.
      return { title, summary: EMPLOYEE_FORM_MESSAGES.unexpected, fieldErrors: {} };
  }
}

/**
 * HU-17/HU-18 Back: 409 when the email or phone is already used by another employee of the
 * business. The field comes in
 * `errors` (assumed: `email` and/or `phone`); our own texts are shown on those fields.
 */
function duplicates(error: ApiError): FieldErrors {
  return {
    ...('email' in error.fieldErrors && { email: EMPLOYEE_FORM_MESSAGES.duplicateEmail }),
    ...('phone' in error.fieldErrors && { phone: EMPLOYEE_FORM_MESSAGES.duplicatePhone }),
  };
}
