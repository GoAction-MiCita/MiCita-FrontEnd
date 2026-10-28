import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { EMPLOYEE_PICKER_TEXTS } from '@features/services/models/employee-picker-texts';
import {
  hasServiceFilters,
  NO_SERVICE_FILTERS,
  sameServiceFilters,
  ServiceFilters,
} from '@features/services/models/service-filters';
import {
  SERVICE_STATUS,
  ServiceEmployee,
  ServiceStatus,
} from '@features/services/models/service.model';
import { FilterBar } from '@shared/ui/filter-bar/filter-bar';
import { MultiSelect } from '@shared/ui/multi-select/multi-select';

/**
 * Filter bar of the services list (HU-13): name, status and employees (HU-12 picker). `filters`
 * is the source of truth (the URL); the bar only emits `filtersChange`.
 */
@Component({
  selector: 'app-services-filter-bar',
  imports: [ReactiveFormsModule, FilterBar, MultiSelect],
  templateUrl: './services-filter-bar.html',
  styleUrl: './services-filter-bar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServicesFilterBar {
  readonly filters = input.required<ServiceFilters>();
  readonly filtersChange = output<ServiceFilters>();
  readonly employees = input<readonly ServiceEmployee[]>([]);
  readonly employeesLoading = input(false);
  readonly employeesFailed = input(false);

  protected readonly status = SERVICE_STATUS;
  protected readonly employeePickerTexts = EMPLOYEE_PICKER_TEXTS;
  protected readonly canClear = computed(() => hasServiceFilters(this.filters()));

  protected readonly statusControl = new FormControl<ServiceStatus | ''>('', { nonNullable: true });
  protected readonly employeeIdsControl = new FormControl<readonly string[]>([], {
    nonNullable: true,
  });

  constructor() {
    // Follow the URL (reload, back/forward, "Limpiar filtros") without emitting again.
    effect(() => {
      const { status, employeeIds } = this.filters();
      untracked(() => {
        this.statusControl.setValue(status ?? '', { emitEvent: false });
        this.employeeIdsControl.setValue(employeeIds, { emitEvent: false });
      });
    });

    this.statusControl.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((status) => this.emit({ status: status || null }));

    this.employeeIdsControl.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((employeeIds) => this.emit({ employeeIds }));
  }

  protected changeName(name: string): void {
    this.emit({ name });
  }

  protected clear(): void {
    this.statusControl.setValue('', { emitEvent: false });
    this.employeeIdsControl.setValue([], { emitEvent: false });
    this.filtersChange.emit(NO_SERVICE_FILTERS);
  }

  private emit(changes: Partial<ServiceFilters>): void {
    const next = { ...this.filters(), ...changes };
    if (!sameServiceFilters(next, this.filters())) {
      this.filtersChange.emit(next);
    }
  }
}
