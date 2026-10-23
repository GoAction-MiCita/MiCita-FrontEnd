export const SERVICE_STATUS = {
  active: 'ACTIVE',
  inactive: 'INACTIVE',
} as const;

export type ServiceStatus = (typeof SERVICE_STATUS)[keyof typeof SERVICE_STATUS];

/** Employee summary shown as an avatar in the services table. */
export interface ServiceEmployee {
  readonly id: string;
  readonly name: string;
  readonly photoUrl: string | null;
}

/** Service of the authenticated user's business. Optional fields are `null` when not set. */
export interface Service {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly durationMinutes: number | null;
  readonly price: number | null;
  readonly status: ServiceStatus;
  readonly employees: readonly ServiceEmployee[];
}

/** One page of services (pagination contract of HU-15). */
export interface ServicePage {
  readonly items: readonly Service[];
  readonly page: number;
  readonly size: number;
  readonly totalElements: number;
  readonly totalPages: number;
}
