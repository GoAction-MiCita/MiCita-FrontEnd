import { computed, inject, Injectable, resource, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ServiceOption } from '../models/employee.model';
import { ServiceOptionsApi } from './service-options-api';

/** HU-17: services of the business for the form's picker, loaded the first time it is needed. */
@Injectable()
export class ServiceOptionsStore {
  private readonly api = inject(ServiceOptionsApi);
  private readonly requested = signal(false);

  // `undefined` params keep the resource idle until load() is called.
  private readonly list = resource({
    params: () => (this.requested() ? true : undefined),
    loader: () => firstValueFrom(this.api.list()),
  });

  readonly loading = computed(() => this.list.isLoading());
  /** The picker only says it could not load them; server details are never shown. */
  readonly failed = computed(() => this.list.error() !== undefined);
  readonly services = computed<readonly ServiceOption[]>(() =>
    this.list.hasValue() ? this.list.value() : [],
  );

  /** First call fetches; later calls retry only after a failure. */
  load(): void {
    if (!this.requested()) {
      this.requested.set(true);
    } else if (this.failed()) {
      this.list.reload();
    }
  }
}
