import { EMPLOYEE_STATUS, EmployeeStatus } from './employee.model';

/** Filters of the employees list (HU-22). Empty values mean "no filter". */
export interface EmployeeFilters {
  /** Contained in the first or last name, case-insensitive. */
  readonly name: string;
  readonly status: EmployeeStatus | null;
  /** Employees who provide at least one of these services. */
  readonly serviceIds: readonly string[];
}

export const NO_EMPLOYEE_FILTERS: EmployeeFilters = { name: '', status: null, serviceIds: [] };

/** Raw query params of `/empleados` (strings from the URL, possibly missing or tampered). */
export interface EmployeeFilterParams {
  readonly name?: string | null;
  readonly status?: string | null;
  readonly serviceIds?: string | null;
}

const NAME_MAX_LENGTH = 100;

export function hasEmployeeFilters(filters: EmployeeFilters): boolean {
  return filters.name !== '' || filters.status !== null || filters.serviceIds.length > 0;
}

/** URL → filters. Unknown statuses are ignored (the backend answers 400 to them). */
export function toEmployeeFilters(params: EmployeeFilterParams): EmployeeFilters {
  const status = params.status;
  return {
    name: (params.name ?? '').trim().slice(0, NAME_MAX_LENGTH),
    status:
      status === EMPLOYEE_STATUS.active || status === EMPLOYEE_STATUS.inactive ? status : null,
    serviceIds: splitIds(params.serviceIds),
  };
}

/** Filters → URL. `null` removes the param so a clean list has a clean URL. */
export function toEmployeeFilterParams(filters: EmployeeFilters): Record<string, string | null> {
  return {
    name: filters.name.trim() || null,
    status: filters.status,
    serviceIds: filters.serviceIds.length > 0 ? filters.serviceIds.join(',') : null,
  };
}

export function sameEmployeeFilters(a: EmployeeFilters, b: EmployeeFilters): boolean {
  return (
    a.name === b.name &&
    a.status === b.status &&
    a.serviceIds.length === b.serviceIds.length &&
    a.serviceIds.every((id, index) => id === b.serviceIds[index])
  );
}

function splitIds(value: string | null | undefined): readonly string[] {
  return [
    ...new Set(
      (value ?? '')
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id !== ''),
    ),
  ];
}
