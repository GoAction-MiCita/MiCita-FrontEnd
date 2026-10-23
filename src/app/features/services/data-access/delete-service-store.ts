import { computed, inject, Injectable, signal } from '@angular/core';
import { AuthSession } from '@core/auth/auth-session';
import { API_ERROR_KIND, ApiError, isApiError } from '@core/http/api-error.model';
import { firstValueFrom } from 'rxjs';
import { DeleteServiceFailure, toDeleteServiceFailure } from '../models/delete-service-failure';
import { Service } from '../models/service.model';
import { ServicesApi } from './services-api';

export type DeleteServiceResult = 'deleted' | 'not-found' | 'failed';

interface DeleteServiceState {
  /** Service waiting for confirmation; `null` while the dialog is closed. */
  readonly service: Service | null;
  readonly pending: boolean;
  readonly failure: DeleteServiceFailure | null;
}

const CLOSED: DeleteServiceState = { service: null, pending: false, failure: null };

const UNKNOWN_ERROR: ApiError = {
  kind: API_ERROR_KIND.unknown,
  status: 0,
  message: null,
  fieldErrors: {},
};

/** State of the "Eliminar servicio" confirmation (HU-14). Provided by ServicesPage. */
@Injectable()
export class DeleteServiceStore {
  private readonly api = inject(ServicesApi);
  private readonly session = inject(AuthSession);
  private readonly state = signal<DeleteServiceState>(CLOSED);

  readonly service = computed(() => this.state().service);
  readonly pending = computed(() => this.state().pending);
  readonly failure = computed(() => this.state().failure);

  /** Asks for confirmation; nothing is sent until `confirm()`. */
  open(service: Service): void {
    this.state.set({ ...CLOSED, service });
  }

  close(): void {
    if (!this.state().pending) {
      this.state.set(CLOSED);
    }
  }

  /** A 404 and a success close the dialog; other failures stay in it. */
  async confirm(): Promise<DeleteServiceResult> {
    const { service, pending, failure } = this.state();
    if (!service || pending || failure?.blocked) {
      return 'failed';
    }
    this.state.set({ service, pending: true, failure: null });
    try {
      await firstValueFrom(this.api.remove(service.id));
      this.state.set(CLOSED);
      return 'deleted';
    } catch (error: unknown) {
      const apiError = isApiError(error) ? error : UNKNOWN_ERROR;
      if (apiError.kind === API_ERROR_KIND.notFound) {
        this.state.set(CLOSED);
        return 'not-found';
      }
      if (apiError.kind === API_ERROR_KIND.unauthorized) {
        this.state.set(CLOSED);
        // A 401 that survived the token refresh ends the session (back to login).
        await this.session.expire();
        return 'failed';
      }
      this.state.set({
        service,
        pending: false,
        failure: toDeleteServiceFailure(apiError, service.name),
      });
      return 'failed';
    }
  }
}
