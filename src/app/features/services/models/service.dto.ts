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

/** Pagination envelope shared by list endpoints (HU-15 Back). */
export interface PageDto<T> {
  readonly content: readonly T[];
  readonly page: number;
  readonly size: number;
  readonly totalElements: number;
  readonly totalPages: number;
}
