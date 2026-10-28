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
import {
  EmployeeFilters,
  hasEmployeeFilters,
  NO_EMPLOYEE_FILTERS,
  sameEmployeeFilters,
} from '@features/employees/models/employee-filters';
import {
  EMPLOYEE_STATUS,
  EmployeeStatus,
  ServiceOption,
} from '@features/employees/models/employee.model';
import { SERVICE_FILTER_TEXTS } from '@features/employees/models/service-picker-texts';
import { FilterBar } from '@shared/ui/filter-bar/filter-bar';
import { MultiSelect, MultiSelectOption } from '@shared/ui/multi-select/multi-select';

/**
 * Filter bar of the employees list (HU-22): name, status and services. `filters` is the source of
 * truth (the URL); the bar only emits `filtersChange`.
 */
@Component({
  selector: 'app-employees-filter-bar',
  imports: [ReactiveFormsModule, FilterBar, MultiSelect],
  templateUrl: './employees-filter-bar.html',
  styleUrl: './employees-filter-bar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmployeesFilterBar {
  readonly filters = input.required<EmployeeFilters>();
  readonly filtersChange = output<EmployeeFilters>();
  readonly services = input<readonly ServiceOption[]>([]);
  readonly servicesLoading = input(false);
  readonly servicesFailed = input(false);

  protected readonly status = EMPLOYEE_STATUS;
  protected readonly servicePickerTexts = SERVICE_FILTER_TEXTS;
  protected readonly canClear = computed(() => hasEmployeeFilters(this.filters()));
  /** Inactive services can be filtered too; they carry an "Inactivo" tag, as in the form. */
  protected readonly serviceOptions = computed<readonly MultiSelectOption[]>(() =>
    this.services().map((service) => ({
      id: service.id,
      name: service.name,
      hint: service.active ? null : 'Inactivo',
    })),
  );

  protected readonly statusControl = new FormControl<EmployeeStatus | ''>('', {
    nonNullable: true,
  });
  protected readonly serviceIdsControl = new FormControl<readonly string[]>([], {
    nonNullable: true,
  });

  constructor() {
    // Follow the URL (reload, back/forward, "Limpiar filtros") without emitting again.
    effect(() => {
      const { status, serviceIds } = this.filters();
      untracked(() => {
        this.statusControl.setValue(status ?? '', { emitEvent: false });
        this.serviceIdsControl.setValue(serviceIds, { emitEvent: false });
      });
    });

    this.statusControl.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((status) => this.emit({ status: status || null }));

    this.serviceIdsControl.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((serviceIds) => this.emit({ serviceIds }));
  }

  protected changeName(name: string): void {
    this.emit({ name });
  }

  protected clear(): void {
    this.statusControl.setValue('', { emitEvent: false });
    this.serviceIdsControl.setValue([], { emitEvent: false });
    this.filtersChange.emit(NO_EMPLOYEE_FILTERS);
  }

  private emit(changes: Partial<EmployeeFilters>): void {
    const next = { ...this.filters(), ...changes };
    if (!sameEmployeeFilters(next, this.filters())) {
      this.filtersChange.emit(next);
    }
  }
}
