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

/** Data captured by the service form (HU-09/HU-10). Optional fields are `null` when empty. */
export interface NewService {
  readonly name: string;
  readonly description: string | null;
  readonly durationMinutes: number | null;
  /** Whole Colombian pesos. */
  readonly price: number | null;
  readonly status: ServiceStatus;
  /** HU-12: employees who can provide the service (empty: none). */
  readonly employeeIds: readonly string[];
}

export type NewServiceField = keyof NewService;

/** One page of services (pagination contract of HU-15). */
export interface ServicePage {
  readonly items: readonly Service[];
  readonly page: number;
  readonly size: number;
  readonly totalElements: number;
  readonly totalPages: number;
}
