/** Data captured by the onboarding form. Optional fields are `null` when left empty. */
export interface NewBusiness {
  readonly name: string;
  readonly address: string;
  readonly phone: string;
  readonly nit: string | null;
  readonly email: string | null;
}

export type NewBusinessField = keyof NewBusiness;

/** Business owned by the authenticated user. */
export interface Business {
  readonly id: string;
  readonly name: string;
  readonly address: string;
  readonly phone: string;
  readonly nit: string | null;
  readonly email: string | null;
  readonly status: string;
  readonly timeZone: string;
}
