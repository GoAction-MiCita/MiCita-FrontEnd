/** Service inside an employee (HU-16 Back): DELETED services never come. */
export interface EmployeeServiceDto {
  readonly id: string;
  readonly name: string;
}

/**
 * Item of `GET /api/empleados` (HU-16 Back), ordered by last name and first name; also the answer
 * of `POST` (HU-17), `GET` and `PUT /api/empleados/{id}` (HU-18).
 */
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

/**
 * Body of `POST /api/empleados` (HU-17 Back); the 201 response is an EmployeeResponseDto.
 * A 400 for rejected services reports each one as `errors["serviceIds[i]"]`, i being its position
 * in this list (assumed, same style as HU-12).
 */
export interface CreateEmployeeRequestDto {
  readonly firstName: string;
  readonly lastName: string;
  readonly phone: string | null;
  readonly email: string | null;
  /** `ACTIVE` or `INACTIVE`. */
  readonly status: string;
  readonly serviceIds: readonly string[];
}

/** Body of `PUT /api/empleados/{id}` (HU-18 Back): same rules as HU-17; `serviceIds` replace the list. */
export type UpdateEmployeeRequestDto = CreateEmployeeRequestDto;

/** Item of `GET /api/servicios` (E02): only what the services picker needs. */
export interface ServiceOptionDto {
  readonly id: string;
  readonly name: string;
  readonly status: string;
}
