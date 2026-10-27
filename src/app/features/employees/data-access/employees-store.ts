import { computed, inject, Injectable, resource, signal } from '@angular/core';
import { API_ERROR_KIND, ApiError, isApiError } from '@core/http/api-error.model';
import { FIRST_PAGE, Paging, samePaging } from '@shared/ui/paginator/paging';
import { firstValueFrom } from 'rxjs';
import { Employee, EmployeeStatus } from '../models/employee.model';
import { EmployeesLoadError, toEmployeesLoadError } from '../models/employees-error';
import { EmployeesApi } from './employees-api';

const UNKNOWN_ERROR: ApiError = {
  kind: API_ERROR_KIND.unknown,
  status: 0,
  message: null,
  fieldErrors: {},
};

/** State of the employees list (HU-16) and its page. Provided by EmployeesPage. */
@Injectable()
export class EmployeesStore {
  private readonly api = inject(EmployeesApi);
  private readonly query = signal<Paging>(FIRST_PAGE);

  readonly paging = this.query.asReadonly();

  // Every page or size change fetches that page.
  private readonly page = resource({
    params: () => this.query(),
    loader: ({ params }) => firstValueFrom(this.api.list(params)),
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
  readonly empty = computed(() => this.noItems() && this.totals().totalElements === 0);

  /** An empty page past the end while there are results (a tampered URL): the last page, else `null`. */
  readonly lastPageIfOutOfRange = computed(() => {
    const { totalElements, totalPages } = this.totals();
    return this.noItems() && totalElements > 0 && this.paging().page >= totalPages
      ? totalPages - 1
      : null;
  });

  /** Equal values (URL round trip) do not refetch. */
  setPaging(paging: Paging): void {
    if (!samePaging(paging, this.query())) {
      this.query.set(paging);
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

  /** Reloads the current page (retry, or after creating or editing). */
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
