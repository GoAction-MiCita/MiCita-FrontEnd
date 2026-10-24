import { computed, inject, Injectable, resource, signal } from '@angular/core';
import { API_ERROR_KIND, ApiError, isApiError } from '@core/http/api-error.model';
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

/** State of the services list (HU-08) and its filters (HU-13). Provided by ServicesPage. */
@Injectable()
export class ServicesStore {
  private readonly api = inject(ServicesApi);
  private readonly currentFilters = signal<ServiceFilters>(NO_SERVICE_FILTERS);

  readonly filters = this.currentFilters.asReadonly();
  readonly filtered = computed(() => hasServiceFilters(this.filters()));

  // A new filters value fetches the list again from the first page.
  private readonly page = resource({
    params: () => this.filters(),
    loader: ({ params }) => firstValueFrom(this.api.list(params)),
  });

  readonly loading = computed(() => this.page.isLoading());

  readonly services = computed<readonly Service[]>(() =>
    this.page.hasValue() ? this.page.value().items : [],
  );

  readonly error = computed<ServicesLoadError | null>(() => {
    const error = this.page.error();
    return error ? toServicesLoadError(unwrapApiError(error)) : null;
  });

  private readonly noItems = computed(
    () => !this.loading() && !this.error() && this.page.hasValue() && this.services().length === 0,
  );

  /** The business has no services at all ("Aún no tienes servicios"). */
  readonly empty = computed(() => this.noItems() && !this.filtered());

  /** Services exist, but none match the filters (a different empty state). */
  readonly noResults = computed(() => this.noItems() && this.filtered());

  /** Ignores values equal to the current ones, so the URL round trip does not refetch. */
  setFilters(filters: ServiceFilters): void {
    if (!sameServiceFilters(filters, this.currentFilters())) {
      this.currentFilters.set(filters);
    }
  }

  /** HU-11: shows the status the backend answered, without fetching the list again. */
  setStatus(id: string, status: ServiceStatus): void {
    this.page.update(
      (page) =>
        page && {
          ...page,
          items: page.items.map((item) => (item.id === id ? { ...item, status } : item)),
        },
    );
  }

  /** Reloads the list with the same filters (retry, or after creating, editing or deleting). */
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
