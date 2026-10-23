import { computed, inject, Injectable, resource } from '@angular/core';
import { API_ERROR_KIND, ApiError, isApiError } from '@core/http/api-error.model';
import { firstValueFrom } from 'rxjs';
import { Service } from '../models/service.model';
import { ServicesLoadError, toServicesLoadError } from '../models/services-error';
import { ServicesApi } from './services-api';

const UNKNOWN_ERROR: ApiError = {
  kind: API_ERROR_KIND.unknown,
  status: 0,
  message: null,
  fieldErrors: {},
};

/** State of the services list (HU-08). Provided by ServicesPage. */
@Injectable()
export class ServicesStore {
  private readonly api = inject(ServicesApi);

  private readonly page = resource({
    loader: () => firstValueFrom(this.api.list()),
  });

  readonly loading = computed(() => this.page.isLoading());

  readonly services = computed<readonly Service[]>(() =>
    this.page.hasValue() ? this.page.value().items : [],
  );

  readonly error = computed<ServicesLoadError | null>(() => {
    const error = this.page.error();
    return error ? toServicesLoadError(unwrapApiError(error)) : null;
  });

  readonly empty = computed(
    () => !this.loading() && !this.error() && this.page.hasValue() && this.services().length === 0,
  );

  /** Reloads the list (retry after an error; HU-09 will call it after creating a service). */
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
