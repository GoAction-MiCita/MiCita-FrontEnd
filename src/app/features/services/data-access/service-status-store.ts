import { inject, Injectable, signal } from '@angular/core';
import { AuthSession } from '@core/auth/auth-session';
import { API_ERROR_KIND, ApiError, isApiError } from '@core/http/api-error.model';
import { firstValueFrom } from 'rxjs';
import { toServiceStatusFailureMessage } from '../models/service-status-messages';
import { SERVICE_STATUS, Service, ServiceStatus } from '../models/service.model';
import { ServicesApi } from './services-api';

export type ServiceStatusChange =
  | { readonly kind: 'changed'; readonly status: ServiceStatus }
  | { readonly kind: 'failed'; readonly message: string }
  /** Already in flight for this service, or the session ended (401). */
  | { readonly kind: 'ignored' };

const UNKNOWN_ERROR: ApiError = {
  kind: API_ERROR_KIND.unknown,
  status: 0,
  message: null,
  fieldErrors: {},
};

/** HU-11 "Activar/Desactivar" from the list: one request at a time per service. */
@Injectable()
export class ServiceStatusStore {
  private readonly api = inject(ServicesApi);
  private readonly session = inject(AuthSession);
  private readonly pending = signal<ReadonlySet<string>>(new Set());

  /** Ids of the services whose change is in flight (their toggle is disabled). */
  readonly pendingIds = this.pending.asReadonly();

  /** The new status is only known (and shown) once the backend answers. */
  async toggle(service: Service): Promise<ServiceStatusChange> {
    if (this.pending().has(service.id)) {
      return { kind: 'ignored' };
    }
    const target =
      service.status === SERVICE_STATUS.active ? SERVICE_STATUS.inactive : SERVICE_STATUS.active;
    this.setPending(service.id, true);
    try {
      const status = await firstValueFrom(this.api.changeStatus(service.id, target));
      return { kind: 'changed', status };
    } catch (error: unknown) {
      const apiError = isApiError(error) ? error : UNKNOWN_ERROR;
      if (apiError.kind === API_ERROR_KIND.unauthorized) {
        // A 401 that survived the token refresh ends the session (back to login).
        await this.session.expire();
        return { kind: 'ignored' };
      }
      return { kind: 'failed', message: toServiceStatusFailureMessage(apiError) };
    } finally {
      this.setPending(service.id, false);
    }
  }

  private setPending(id: string, pending: boolean): void {
    this.pending.update((ids) => {
      const next = new Set(ids);
      if (pending) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }
}
