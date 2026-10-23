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
 * `employeeIds` is left out until HU-12.
 */
export interface CreateServiceRequestDto {
  readonly name: string;
  readonly description: string | null;
  readonly durationMinutes: number | null;
  readonly price: number | null;
  /** `ACTIVE` or `INACTIVE`. */
  readonly status: string;
}

/**
 * Body of `PUT /api/servicios/{id}` (HU-10 Back); the 200 response is a ServiceResponseDto.
 * `employeeIds` replaces the whole association (an empty list removes everyone).
 */
export interface UpdateServiceRequestDto extends CreateServiceRequestDto {
  readonly employeeIds: readonly string[];
}

/** Pagination envelope shared by list endpoints (HU-15 Back). */
export interface PageDto<T> {
  readonly content: readonly T[];
  readonly page: number;
  readonly size: number;
  readonly totalElements: number;
  readonly totalPages: number;
}
