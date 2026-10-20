/** Body of `POST /api/negocios/onboarding` (HU-03 Back). Field names pending confirmation. */
export interface CreateBusinessRequestDto {
  readonly name: string;
  readonly address: string;
  readonly phone: string;
  readonly nit: string | null;
  readonly email: string | null;
}

/** 201 response of `POST /api/negocios/onboarding`. */
export interface BusinessResponseDto {
  readonly id: string;
  readonly name: string;
  readonly address: string;
  readonly phone: string;
  readonly nit?: string | null;
  readonly email?: string | null;
  /** Initial status, `ACTIVE` per HU-03 Back. */
  readonly status: string;
  /** `America/Bogota` by default. */
  readonly timeZone: string;
}
