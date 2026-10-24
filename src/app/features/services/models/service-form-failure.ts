import { API_ERROR_KIND, ApiError } from '@core/http/api-error.model';
import { FieldErrors } from '@shared/models/field-errors.model';
import { toNewServiceFieldErrors, toRejectedEmployeeIds } from './service.mapper';

/** What the service panel shows after a failed `POST /servicios`, `GET` or `PUT /servicios/{id}`. */
export interface ServiceFormFailure {
  readonly title: string;
  readonly summary: string;
  /** Errors to attach to form controls (form field → message). */
  readonly fieldErrors: FieldErrors;
  /** HU-12: employees the backend rejected (400), marked in the picker. */
  readonly rejectedEmployeeIds?: readonly string[];
}

export const SERVICE_FORM_MESSAGES = {
  title: 'No pudimos crear el servicio',
  updateTitle: 'No pudimos guardar los cambios',
  loadTitle: 'No pudimos cargar el servicio',
  checkFields: 'Revisa los campos marcados e inténtalo de nuevo.',
  duplicate: 'Ya tienes un servicio con ese nombre. Usa un nombre diferente.',
  duplicateName: 'Ya existe un servicio con ese nombre',
  businessRequired: 'Necesitas registrar tu negocio para gestionar servicios.',
  network: 'No pudimos conectar con el servidor. Verifica tu conexión e inténtalo de nuevo.',
  unexpected: 'Ocurrió un error inesperado. Inténtalo de nuevo más tarde.',
} as const;

/** `sentEmployeeIds`: the list sent, to turn `employeeIds[i]` errors into employee ids. */
export function toServiceFormFailure(
  error: ApiError,
  title: string = SERVICE_FORM_MESSAGES.title,
  sentEmployeeIds: readonly string[] = [],
): ServiceFormFailure {
  switch (error.kind) {
    case API_ERROR_KIND.validation:
      return {
        title,
        summary: SERVICE_FORM_MESSAGES.checkFields,
        fieldErrors: toNewServiceFieldErrors(error.fieldErrors),
        rejectedEmployeeIds: toRejectedEmployeeIds(error.fieldErrors, sentEmployeeIds),
      };
    case API_ERROR_KIND.conflict:
      // HU-09/HU-10 Back: the only 409 is a duplicate name within the business.
      return {
        title,
        summary: SERVICE_FORM_MESSAGES.duplicate,
        fieldErrors: { name: SERVICE_FORM_MESSAGES.duplicateName },
      };
    case API_ERROR_KIND.forbidden:
      return { title, summary: SERVICE_FORM_MESSAGES.businessRequired, fieldErrors: {} };
    case API_ERROR_KIND.network:
      return { title, summary: SERVICE_FORM_MESSAGES.network, fieldErrors: {} };
    default:
      // Server details are never shown to the user.
      return { title, summary: SERVICE_FORM_MESSAGES.unexpected, fieldErrors: {} };
  }
}
