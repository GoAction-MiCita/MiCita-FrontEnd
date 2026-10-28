import { computed, inject, Injectable, resource, signal } from '@angular/core';
import { API_ERROR_KIND, ApiError, isApiError } from '@core/http/api-error.model';
import { FIRST_PAGE, Paging, samePaging } from '@shared/ui/paginator/paging';
import { firstValueFrom } from 'rxjs';
import {
  hasServiceFilters,
  NO_SERVICE_FILTERS,
  sameServiceFilters,
  ServiceFilters,
} from '../models/service-filters';
import { Service, ServiceStatus } from '../models/service.model';
import { ServicesLoadError, toServicesLoadError } from '../models/services-error';
import { ServicesApi } from './services-api';

const UNKNOWN_ERROR: ApiError = {
  kind: API_ERROR_KIND.unknown,
  status: 0,
  message: null,
  fieldErrors: {},
};

interface ServicesQuery {
  readonly filters: ServiceFilters;
  readonly paging: Paging;
}

/**
 * State of the services list (HU-08), its filters (HU-13) and its page (HU-15).
 * Provided by ServicesPage.
 */
@Injectable()
export class ServicesStore {
  private readonly api = inject(ServicesApi);
  private readonly query = signal<ServicesQuery>({
    filters: NO_SERVICE_FILTERS,
    paging: FIRST_PAGE,
  });

  readonly filters = computed(() => this.query().filters);
  readonly paging = computed(() => this.query().paging);
  readonly filtered = computed(() => hasServiceFilters(this.filters()));

  // Every query change (filters, page or size) fetches that page with those filters.
  private readonly page = resource({
    params: () => this.query(),
    loader: ({ params }) => firstValueFrom(this.api.list(params.filters, params.paging)),
  });

  readonly loading = computed(() => this.page.isLoading());

  readonly services = computed<readonly Service[]>(() =>
    this.page.hasValue() ? this.page.value().items : [],
  );

  /** Totals of the last page received, for the paginator. */
  readonly totals = computed(() => {
    const page = this.page.hasValue() ? this.page.value() : null;
    return { totalElements: page?.totalElements ?? 0, totalPages: page?.totalPages ?? 0 };
  });

  readonly error = computed<ServicesLoadError | null>(() => {
    const error = this.page.error();
    return error ? toServicesLoadError(unwrapApiError(error)) : null;
  });

  private readonly noItems = computed(
    () => !this.loading() && !this.error() && this.page.hasValue() && this.services().length === 0,
  );

  /** The business has no services at all ("Aún no tienes servicios"). */
  readonly empty = computed(
    () => this.noItems() && !this.filtered() && this.totals().totalElements === 0,
  );

  /** Services exist, but none match the filters (a different empty state). */
  readonly noResults = computed(
    () => this.noItems() && this.filtered() && this.totals().totalElements === 0,
  );

  /**
   * A page past the end that came back empty while there are results (after deleting the
   * last row of the last page, or a tampered URL): the last page that exists, else `null`.
   */
  readonly lastPageIfOutOfRange = computed(() => {
    const { totalElements, totalPages } = this.totals();
    return this.noItems() && totalElements > 0 && this.paging().page >= totalPages
      ? totalPages - 1
      : null;
  });

  setPaging(paging: Paging): void {
    if (!samePaging(paging, this.paging())) {
      this.query.update((query) => ({ ...query, paging }));
    }
  }

  /** Both at once, as read from the URL, so a link with filters and page fetches only once. */
  setQuery(filters: ServiceFilters, paging: Paging): void {
    const current = this.query();
    if (!sameServiceFilters(filters, current.filters) || !samePaging(paging, current.paging)) {
      this.query.set({ filters, paging });
    }
  }

  /** HU-11: shows the status the backend answered, without fetching the list again. */
  setStatus(id: string, status: ServiceStatus): void {
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
