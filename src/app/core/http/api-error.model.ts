import { FieldErrors } from '@shared/models/field-errors.model';

export const API_ERROR_KIND = {
  validation: 'validation',
  conflict: 'conflict',
  unauthorized: 'unauthorized',
  forbidden: 'forbidden',
  notFound: 'not-found',
  network: 'network',
  server: 'server',
  unknown: 'unknown',
} as const;

export type ApiErrorKind = (typeof API_ERROR_KIND)[keyof typeof API_ERROR_KIND];

interface ApiErrorBase {
  readonly status: number;
  /** Human readable message from the server (`detail` or `title`), if any. */
  readonly message: string | null;
}

export interface ValidationApiError extends ApiErrorBase {
  readonly kind: typeof API_ERROR_KIND.validation;
  readonly fieldErrors: FieldErrors;
}

export interface OtherApiError extends ApiErrorBase {
  readonly kind: Exclude<ApiErrorKind, typeof API_ERROR_KIND.validation>;
}

/** Normalized HTTP error. Every failed HttpClient call rethrows one of these (see errorInterceptor). */
export type ApiError = ValidationApiError | OtherApiError;

const KINDS: readonly unknown[] = Object.values(API_ERROR_KIND);

export function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'kind' in value &&
    'status' in value &&
    KINDS.includes(value.kind)
  );
}
