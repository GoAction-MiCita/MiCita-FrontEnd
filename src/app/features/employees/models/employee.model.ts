export const EMPLOYEE_STATUS = {
  active: 'ACTIVE',
  inactive: 'INACTIVE',
} as const;

export type EmployeeStatus = (typeof EMPLOYEE_STATUS)[keyof typeof EMPLOYEE_STATUS];

/** Service the employee provides, shown as a tag. */
export interface EmployeeService {
  readonly id: string;
  readonly name: string;
}

/** Employee of the authenticated user's business. Optional fields are `null` when not set. */
export interface Employee {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly fullName: string;
  readonly phone: string | null;
  readonly email: string | null;
  readonly status: EmployeeStatus;
  readonly services: readonly EmployeeService[];
}

/** One page of employees (pagination contract of HU-15 Back). */
export interface EmployeePage {
  readonly items: readonly Employee[];
  readonly page: number;
  readonly size: number;
  readonly totalElements: number;
  readonly totalPages: number;
}

/** Data captured by the employee form (HU-17). Optional fields are `null` when empty. */
export interface NewEmployee {
  readonly firstName: string;
  readonly lastName: string;
  readonly phone: string | null;
  readonly email: string | null;
  readonly status: EmployeeStatus;
  /** Services the employee provides (empty: none). */
  readonly serviceIds: readonly string[];
}

export type NewEmployeeField = keyof NewEmployee;

/** Service of the business offered by the form's services picker (not DELETED). */
export interface ServiceOption {
  readonly id: string;
  readonly name: string;
  readonly active: boolean;
}
