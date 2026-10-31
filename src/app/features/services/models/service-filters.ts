import { capName, sameIds, splitIds } from '@shared/models/list-filter-params';
import { SERVICE_STATUS, ServiceStatus } from './service.model';

/** Filters of the services list (HU-13). Empty values mean "no filter". */
export interface ServiceFilters {
  readonly name: string;
  readonly status: ServiceStatus | null;
  /** Services with at least one of these employees (selector: HU-12). */
  readonly employeeIds: readonly string[];
}

export const NO_SERVICE_FILTERS: ServiceFilters = { name: '', status: null, employeeIds: [] };

/** Raw query params of `/servicios` (strings from the URL, possibly missing or tampered). */
export interface ServiceFilterParams {
  readonly name?: string | null;
  readonly status?: string | null;
  readonly employeeIds?: string | null;
}

export function hasServiceFilters(filters: ServiceFilters): boolean {
  return filters.name !== '' || filters.status !== null || filters.employeeIds.length > 0;
}

/** URL → filters. Unknown statuses are ignored (the backend answers 400 to them). */
export function toServiceFilters(params: ServiceFilterParams): ServiceFilters {
  const status = params.status;
  return {
    name: capName(params.name),
    status: status === SERVICE_STATUS.active || status === SERVICE_STATUS.inactive ? status : null,
    employeeIds: splitIds(params.employeeIds),
  };
}

/** Filters → URL. `null` removes the param so a clean list has a clean URL. */
export function toServiceFilterParams(filters: ServiceFilters): Record<string, string | null> {
  return {
    name: filters.name.trim() || null,
    status: filters.status,
    employeeIds: filters.employeeIds.length > 0 ? filters.employeeIds.join(',') : null,
  };
}

export function sameServiceFilters(a: ServiceFilters, b: ServiceFilters): boolean {
  return a.name === b.name && a.status === b.status && sameIds(a.employeeIds, b.employeeIds);
}
