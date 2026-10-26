/** Employee inside a service (HU-08 Back: id, name, photo). Field names pending confirmation. */
export interface ServiceEmployeeDto {
  readonly id: string;
  readonly name: string;
  /** `null` until E03 (employees) stores photos. */
  readonly photoUrl?: string | null;
}

/** Item of `GET /api/servicios`. */
export interface ServiceResponseDto {
  readonly id: string;
  readonly name: string;
  readonly description?: string | null;
  readonly durationMinutes?: number | null;
  readonly price?: number | null;
  readonly status: string;
  /** Empty until HU-12 Back associates employees. */
  readonly employees?: readonly ServiceEmployeeDto[] | null;
}

/**
 * Body of `POST /api/servicios` (HU-09 Back); the 201 response is a ServiceResponseDto.
 * `employeeIds` (HU-12) is the whole association; a 400 for rejected employees reports each one
 * as `errors["employeeIds[i]"]`, i being its position in this list (assumed, Spring style).
 */
export interface CreateServiceRequestDto {
  readonly name: string;
  readonly description: string | null;
  readonly durationMinutes: number | null;
  readonly price: number | null;
  /** `ACTIVE` or `INACTIVE`. */
  readonly status: string;
  readonly employeeIds: readonly string[];
}

/**
 * Body of `PUT /api/servicios/{id}` (HU-10 Back); the 200 response is a ServiceResponseDto.
 * `employeeIds` replaces the whole association (an empty list removes everyone).
 */
export type UpdateServiceRequestDto = CreateServiceRequestDto;

/** Body of `PATCH /api/servicios/{id}/estado` (HU-11 Back): `ACTIVE` or `INACTIVE`. */
export interface UpdateServiceStatusRequestDto {
  readonly status: string;
}

/**
 * Item of `GET /api/empleados` (E03, HU-16 Back): only what the picker needs. No photos in the
 * MVP; the employees feature has its own complete DTO.
 */
export interface EmployeeResponseDto {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
}

/** Pagination envelope shared by list endpoints (HU-15 Back). */
export interface PageDto<T> {
  readonly content: readonly T[];
  readonly page: number;
  readonly size: number;
  readonly totalElements: number;
  readonly totalPages: number;
}
