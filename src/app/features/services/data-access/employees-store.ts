import { computed, inject, Injectable, resource } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ServiceEmployee } from '../models/service.model';
import { EmployeesApi } from './employees-api';

/** HU-12: employees of the business, loaded once for the pickers of the page. */
@Injectable()
export class EmployeesStore {
  private readonly api = inject(EmployeesApi);

  private readonly list = resource({ loader: () => firstValueFrom(this.api.list()) });

  readonly loading = computed(() => this.list.isLoading());
  /** The picker only says it could not load them; server details are never shown. */
  readonly failed = computed(() => this.list.error() !== undefined);
  readonly employees = computed<readonly ServiceEmployee[]>(() =>
    this.list.hasValue() ? this.list.value() : [],
  );

  reload(): void {
    this.list.reload();
  }
}
