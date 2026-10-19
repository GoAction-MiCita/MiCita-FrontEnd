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

/** Normalized HTTP error. Every failed HttpClient call rethrows one of these (see errorInterceptor). */
export interface ApiError {
  readonly kind: ApiErrorKind;
  readonly status: number;
  /** Human readable message from the server (`detail` or `title`), if any. */
  readonly message: string | null;
  /** ProblemDetail `errors` map (field → message). Usually filled on 400; empty when absent. */
  readonly fieldErrors: FieldErrors;
}

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
