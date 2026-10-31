import { API_ERROR_KIND, ApiError } from '@core/http/api-error.model';
import { FieldErrors } from '@shared/models/field-errors.model';
import { toNewUserFieldErrors } from './user.mapper';
import { NewUserField } from './user.model';

/** What the register page needs to show after a failed `POST /auth/register`. */
export interface RegisterFailure {
  /** Message for the banner on top of the form. */
  readonly summary: string;
  /** Errors to attach to form controls (form field → message). */
  readonly fieldErrors: FieldErrors;
}

type DuplicableField = Extract<NewUserField, 'email' | 'username'>;

const DUPLICATE_MESSAGES: Readonly<Record<DuplicableField, string>> = {
  email: 'Este correo ya está registrado',
  username: 'Este nombre de usuario ya está en uso',
};

// The backend writes 400 field messages in English, so the UI shows its own text per field.
const INVALID_FIELD_MESSAGES: Readonly<Record<NewUserField, string>> = {
  firstName: 'Ingresa un nombre válido (máximo 100 caracteres)',
  lastName: 'Ingresa un apellido válido (máximo 100 caracteres)',
  address: 'Ingresa una dirección válida (máximo 255 caracteres)',
  phone: 'Ingresa un teléfono válido (7 a 15 dígitos)',
  email: 'Ingresa un correo válido',
  username: 'Ingresa un nombre de usuario válido (máximo 50 caracteres)',
  password: 'La contraseña no cumple las reglas de seguridad',
};

const SUMMARY = {
  checkFields: 'Revisa los campos marcados e inténtalo de nuevo.',
  duplicate: 'El correo o el nombre de usuario ya están registrados.',
  network: 'No pudimos conectar con el servidor. Verifica tu conexión e inténtalo de nuevo.',
  unexpected: 'Ocurrió un error inesperado. Inténtalo de nuevo más tarde.',
} as const;

export function toRegisterFailure(error: ApiError): RegisterFailure {
  switch (error.kind) {
    case API_ERROR_KIND.validation:
      return { summary: SUMMARY.checkFields, fieldErrors: toInvalidFieldMessages(error) };
    case API_ERROR_KIND.conflict: {
      const field = duplicatedField(error);
      return field
        ? { summary: SUMMARY.checkFields, fieldErrors: { [field]: DUPLICATE_MESSAGES[field] } }
        : { summary: SUMMARY.duplicate, fieldErrors: {} };
    }
    case API_ERROR_KIND.network:
      return { summary: SUMMARY.network, fieldErrors: {} };
    default:
      return { summary: SUMMARY.unexpected, fieldErrors: {} };
  }
}

/** Keeps the fields the server rejected, with the Spanish message of each known form field. */
function toInvalidFieldMessages(error: ApiError): FieldErrors {
  const entries = Object.entries(toNewUserFieldErrors(error.fieldErrors)).map(
    ([field, message]) =>
      [field, INVALID_FIELD_MESSAGES[field as NewUserField] ?? message] as const,
  );
  return Object.fromEntries(entries);
}

/**
 * The 409 ProblemDetail does not have a fixed shape for the duplicated field:
 * use the `errors` map when present, otherwise look for the field in `detail`.
 */
function duplicatedField(error: ApiError): DuplicableField | null {
  const fields = Object.keys(toNewUserFieldErrors(error.fieldErrors));
  const mentionsEmail = fields.includes('email') || /correo|e-?mail/i.test(error.message ?? '');
  const mentionsUsername =
    fields.includes('username') || /usuario|username/i.test(error.message ?? '');

  if (mentionsEmail === mentionsUsername) {
    return null;
  }
  return mentionsEmail ? 'email' : 'username';
}
