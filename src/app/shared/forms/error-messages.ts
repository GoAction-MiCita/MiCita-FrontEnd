import { ValidationErrors } from '@angular/forms';

/** Builds the user-facing message for one validation error, or `null` to show nothing. */
export type ErrorMessageFn = (error: unknown) => string | null;

/** Per-field overrides: a fixed text or a function of the error value. */
export type ErrorMessages = Readonly<Record<string, string | ErrorMessageFn>>;

const DEFAULT_ERROR_MESSAGES: ErrorMessages = {
  required: 'Este campo es obligatorio',
  email: 'Ingresa un correo válido',
  nit: 'Ingresa un NIT válido (ej. 900.123.456-7)',
  phone: 'Ingresa un teléfono válido (7 a 15 dígitos)',
  minlength: (error) => `Debe tener al menos ${requiredLength(error)} caracteres`,
  maxlength: (error) => `Debe tener máximo ${requiredLength(error)} caracteres`,
  min: (error) => `Debe ser mayor o igual a ${minimum(error)}`,
  integer: 'Ingresa un número entero',
  // Server messages arrive already written for the user.
  server: (error) => (typeof error === 'string' ? error : null),
  // Shown as a rules checklist next to the field instead of a single message.
  passwordStrength: () => null,
};

// Server errors win: they are the most specific feedback after a submit.
const PRIORITY = ['server', 'required'];

/** Resolves the message for the most relevant error, using `overrides` before the defaults. */
export function resolveErrorMessage(
  errors: ValidationErrors | null,
  overrides: ErrorMessages = {},
): string | null {
  if (!errors) {
    return null;
  }
  const keys = Object.keys(errors).sort((a, b) => priorityOf(a) - priorityOf(b));
  for (const key of keys) {
    const message = overrides[key] ?? DEFAULT_ERROR_MESSAGES[key];
    if (message === undefined) {
      continue;
    }
    return typeof message === 'string' ? message : message(errors[key]);
  }
  return null;
}

function priorityOf(key: string): number {
  const index = PRIORITY.indexOf(key);
  return index === -1 ? PRIORITY.length : index;
}

function minimum(error: unknown): number | string {
  return typeof error === 'object' && error !== null && 'min' in error ? Number(error.min) : '';
}

function requiredLength(error: unknown): number | string {
  return typeof error === 'object' && error !== null && 'requiredLength' in error
    ? Number(error.requiredLength)
    : '';
}
