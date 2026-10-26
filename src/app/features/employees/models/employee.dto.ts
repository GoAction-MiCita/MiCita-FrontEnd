/** Service inside an employee (HU-16 Back): DELETED services never come. */
export interface EmployeeServiceDto {
  readonly id: string;
  readonly name: string;
}

/** Item of `GET /api/empleados` (HU-16 Back), ordered by last name and first name. */
export interface EmployeeResponseDto {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly phone?: string | null;
  readonly email?: string | null;
  /** `ACTIVE` or `INACTIVE`; DELETED employees never come. */
  readonly status: string;
  readonly services?: readonly EmployeeServiceDto[] | null;
}

/** Pagination envelope of the list endpoints (`PageResponse`, HU-15 Back). */
export interface PageDto<T> {
  readonly content: readonly T[];
  readonly page: number;
  readonly size: number;
  readonly totalElements: number;
  readonly totalPages: number;
}
