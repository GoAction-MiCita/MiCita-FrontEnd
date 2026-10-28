import { computed, inject, Injectable, resource, signal } from '@angular/core';
import { API_ERROR_KIND, ApiError, isApiError } from '@core/http/api-error.model';
import { FIRST_PAGE, Paging, samePaging } from '@shared/ui/paginator/paging';
import { firstValueFrom } from 'rxjs';
import {
  EmployeeFilters,
  hasEmployeeFilters,
  NO_EMPLOYEE_FILTERS,
  sameEmployeeFilters,
} from '../models/employee-filters';
import { Employee, EmployeeStatus } from '../models/employee.model';
import { EmployeesLoadError, toEmployeesLoadError } from '../models/employees-error';
import { EmployeesApi } from './employees-api';

const UNKNOWN_ERROR: ApiError = {
  kind: API_ERROR_KIND.unknown,
  status: 0,
  message: null,
  fieldErrors: {},
};

interface EmployeesQuery {
  readonly filters: EmployeeFilters;
  readonly paging: Paging;
}

/**
 * State of the employees list (HU-16), its filters (HU-22) and its page. Provided by
 * EmployeesPage.
 */
@Injectable()
export class EmployeesStore {
  private readonly api = inject(EmployeesApi);
  private readonly query = signal<EmployeesQuery>({
    filters: NO_EMPLOYEE_FILTERS,
    paging: FIRST_PAGE,
  });

  readonly filters = computed(() => this.query().filters);
  readonly paging = computed(() => this.query().paging);
  readonly filtered = computed(() => hasEmployeeFilters(this.filters()));

  // Every query change (filters, page or size) fetches that page with those filters.
  private readonly page = resource({
    params: () => this.query(),
    loader: ({ params }) => firstValueFrom(this.api.list(params.filters, params.paging)),
  });

  readonly loading = computed(() => this.page.isLoading());

  readonly employees = computed<readonly Employee[]>(() =>
    this.page.hasValue() ? this.page.value().items : [],
  );

  /** Totals of the last page received, for the paginator. */
  readonly totals = computed(() => {
    const page = this.page.hasValue() ? this.page.value() : null;
    return { totalElements: page?.totalElements ?? 0, totalPages: page?.totalPages ?? 0 };
  });

  readonly error = computed<EmployeesLoadError | null>(() => {
    const error = this.page.error();
    return error ? toEmployeesLoadError(unwrapApiError(error)) : null;
  });

  private readonly noItems = computed(
    () => !this.loading() && !this.error() && this.page.hasValue() && this.employees().length === 0,
  );

  /** The business has no employees at all ("Aún no tienes empleados"). */
  readonly empty = computed(
    () => this.noItems() && !this.filtered() && this.totals().totalElements === 0,
  );

  /** HU-22: employees exist, but none match the filters (a different empty state). */
  readonly noResults = computed(
    () => this.noItems() && this.filtered() && this.totals().totalElements === 0,
  );

  /** An empty page past the end while there are results (a tampered URL): the last page, else `null`. */
  readonly lastPageIfOutOfRange = computed(() => {
    const { totalElements, totalPages } = this.totals();
    return this.noItems() && totalElements > 0 && this.paging().page >= totalPages
      ? totalPages - 1
      : null;
  });

  /** New filters go back to the first page; equal values (URL round trip) do not refetch. */
  setFilters(filters: EmployeeFilters): void {
    const { filters: current, paging } = this.query();
    if (!sameEmployeeFilters(filters, current)) {
      this.query.set({ filters, paging: { ...paging, page: 0 } });
    }
  }

  /** Equal values (URL round trip) do not refetch. */
  setPaging(paging: Paging): void {
    if (!samePaging(paging, this.paging())) {
      this.query.update((query) => ({ ...query, paging }));
    }
  }

  /** Both at once, as read from the URL, so a link with filters and page fetches only once. */
  setQuery(filters: EmployeeFilters, paging: Paging): void {
    const current = this.query();
    if (!sameEmployeeFilters(filters, current.filters) || !samePaging(paging, current.paging)) {
      this.query.set({ filters, paging });
    }
  }

  /** HU-20: shows the status the backend answered without reloading the page. */
  setStatus(id: string, status: EmployeeStatus): void {
    // set() aborts a load in flight (page change, reload); that load already brings the stored
    // status, so the page is left alone.
    if (this.page.isLoading() || !this.page.hasValue()) {
      return;
    }
    const page = this.page.value();
    if (page.items.some((item) => item.id === id)) {
      this.page.set({
        ...page,
        items: page.items.map((item) => (item.id === id ? { ...item, status } : item)),
      });
    }
  }

  /** Reloads the current page with the same filters (retry, or after creating, editing or deleting). */
  reload(): void {
    this.page.reload();
  }
}

// resource() wraps non-Error rejections (our ApiError objects) and keeps them in `cause`.
function unwrapApiError(error: unknown): ApiError {
  if (isApiError(error)) {
    return error;
  }
  const cause = error instanceof Error ? error.cause : undefined;
  return isApiError(cause) ? cause : UNKNOWN_ERROR;
}
