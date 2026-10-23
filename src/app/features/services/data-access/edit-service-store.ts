import { computed, inject, Injectable, signal } from '@angular/core';
import { AuthSession } from '@core/auth/auth-session';
import { API_ERROR_KIND, ApiError, isApiError } from '@core/http/api-error.model';
import { firstValueFrom } from 'rxjs';
import {
  SERVICE_FORM_MESSAGES,
  ServiceFormFailure,
  toServiceFormFailure,
} from '../models/service-form-failure';
import { NewService, Service } from '../models/service.model';
import { ServicesApi } from './services-api';

/** `stale`: the panel was closed or reopened before the answer arrived. */
export type LoadServiceResult = 'loaded' | 'not-found' | 'failed' | 'stale';
export type SaveServiceResult = 'saved' | 'not-found' | 'failed';

interface EditServiceState {
  readonly loading: boolean;
  readonly service: Service | null;
  readonly pending: boolean;
  readonly failure: ServiceFormFailure | null;
}

const IDLE: EditServiceState = { loading: false, service: null, pending: false, failure: null };

const UNKNOWN_ERROR: ApiError = {
  kind: API_ERROR_KIND.unknown,
  status: 0,
  message: null,
  fieldErrors: {},
};

/** State of the "Editar servicio" panel (HU-10). Provided by ServicesPage. */
@Injectable()
export class EditServiceStore {
  private readonly api = inject(ServicesApi);
  private readonly session = inject(AuthSession);
  private readonly state = signal<EditServiceState>(IDLE);
  private request = 0;

  readonly loading = computed(() => this.state().loading);
  readonly service = computed(() => this.state().service);
  readonly pending = computed(() => this.state().pending);
  readonly failure = computed(() => this.state().failure);

  /** Fetches the current data of the service (not the possibly outdated row of the list). */
  async load(id: string): Promise<LoadServiceResult> {
    const request = ++this.request;
    this.state.set({ ...IDLE, loading: true });
    try {
      const service = await firstValueFrom(this.api.get(id));
      if (request !== this.request) {
        return 'stale';
      }
      this.state.set({ ...IDLE, service });
      return 'loaded';
    } catch (error: unknown) {
      if (request !== this.request) {
        return 'stale';
      }
      return this.fail(error, SERVICE_FORM_MESSAGES.loadTitle, { ...IDLE });
    }
  }

  /** Sends the form with the employees the service already had (no picker until HU-12). */
  async save(changes: NewService): Promise<SaveServiceResult> {
    const { service, pending } = this.state();
    if (!service || pending) {
      return 'failed';
    }
    this.state.set({ ...IDLE, service, pending: true });
    const employeeIds = service.employees.map((employee) => employee.id);
    try {
      await firstValueFrom(this.api.update(service.id, changes, employeeIds));
      this.state.set({ ...IDLE, service });
      return 'saved';
    } catch (error: unknown) {
      return this.fail(error, SERVICE_FORM_MESSAGES.updateTitle, { ...IDLE, service });
    }
  }

  /** Forgets the service and ignores any answer still in flight. */
  reset(): void {
    this.request++;
    this.state.set(IDLE);
  }

  /** A 404 is left to the page; a 401 that survived the token refresh ends the session. */
  private async fail(
    error: unknown,
    title: string,
    next: EditServiceState,
  ): Promise<'not-found' | 'failed'> {
    const apiError = isApiError(error) ? error : UNKNOWN_ERROR;
    if (apiError.kind === API_ERROR_KIND.notFound) {
      this.state.set(next);
      return 'not-found';
    }
    if (apiError.kind === API_ERROR_KIND.unauthorized) {
      this.state.set(next);
      await this.session.expire();
      return 'failed';
    }
    this.state.set({ ...next, failure: toServiceFormFailure(apiError, title) });
    return 'failed';
  }
}
