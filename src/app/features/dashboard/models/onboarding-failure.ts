import { API_ERROR_KIND, ApiError } from '@core/http/api-error.model';
import { FieldErrors } from '@shared/models/field-errors.model';
import { toNewBusinessFieldErrors } from './business.mapper';

/** What the onboarding dialog shows after a failed `POST /negocios/onboarding`. */
export interface OnboardingFailure {
  readonly title: string;
  readonly summary: string;
  /** Errors to attach to form controls (form field → message). */
  readonly fieldErrors: FieldErrors;
}

const TITLES = {
  failed: 'No pudimos registrar tu negocio',
  duplicate: 'Este negocio ya está registrado',
} as const;

const SUMMARY = {
  checkFields: 'Revisa los campos marcados e inténtalo de nuevo.',
  duplicateNit: 'Ya existe un negocio con el mismo NIT. Verifica los datos.',
  alreadyHasBusiness: 'Tu cuenta ya tiene un negocio registrado.',
  network: 'No pudimos conectar con el servidor. Verifica tu conexión e inténtalo de nuevo.',
  unexpected: 'Ocurrió un error inesperado. Inténtalo de nuevo más tarde.',
} as const;

const DUPLICATE_NIT_MESSAGE = 'Este NIT ya está registrado';

export function toOnboardingFailure(error: ApiError): OnboardingFailure {
  switch (error.kind) {
    case API_ERROR_KIND.validation:
      return {
        title: TITLES.failed,
        summary: SUMMARY.checkFields,
        fieldErrors: toNewBusinessFieldErrors(error.fieldErrors),
      };
    case API_ERROR_KIND.conflict:
      return isDuplicateNit(error)
        ? {
            title: TITLES.duplicate,
            summary: SUMMARY.duplicateNit,
            fieldErrors: { nit: DUPLICATE_NIT_MESSAGE },
          }
        : // HU-03 Back: 409 also means "this user already has a business".
          { title: TITLES.duplicate, summary: SUMMARY.alreadyHasBusiness, fieldErrors: {} };
    case API_ERROR_KIND.network:
      return { title: TITLES.failed, summary: SUMMARY.network, fieldErrors: {} };
    default:
      return { title: TITLES.failed, summary: SUMMARY.unexpected, fieldErrors: {} };
  }
}

function isDuplicateNit(error: ApiError): boolean {
  return (
    'nit' in toNewBusinessFieldErrors(error.fieldErrors) || /\bnit\b/i.test(error.message ?? '')
  );
}
