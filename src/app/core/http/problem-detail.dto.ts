/** RFC 9457 error body returned by the backend (Spring `ProblemDetail`). */
export interface ProblemDetailDto {
  readonly type?: string;
  readonly title?: string;
  readonly status?: number;
  readonly detail?: string;
  readonly instance?: string;
  /** Present on 400: field → message. */
  readonly errors?: Record<string, string>;
}
