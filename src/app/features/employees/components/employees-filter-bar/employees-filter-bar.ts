import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
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
import { Icon } from '@shared/ui/icon/icon';
import { MultiSelect, MultiSelectOption } from '@shared/ui/multi-select/multi-select';
import { map, Subject, switchMap, takeUntil, timer } from 'rxjs';

/** HU-22 (same as HU-13): wait after the last keystroke before filtering by name. */
export const NAME_FILTER_DEBOUNCE_MS = 300;

/**
 * Filter bar of the employees list (HU-22): name, status and services. `filters` is the source of
 * truth (the URL); the bar only emits `filtersChange`.
 */
@Component({
  selector: 'app-employees-filter-bar',
  imports: [ReactiveFormsModule, MultiSelect, Icon],
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

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: [''],
    status: ['' as EmployeeStatus | ''],
    serviceIds: [[] as readonly string[]],
  });

  private readonly cancelName = new Subject<void>();

  constructor() {
    // Follow the URL (reload, back/forward, "Limpiar filtros") without emitting again.
    effect(() => {
      const { name, status, serviceIds } = this.filters();
      untracked(() => {
        const controls = this.form.controls;
        if (controls.name.value.trim() !== name) {
          controls.name.setValue(name, { emitEvent: false });
        }
        controls.status.setValue(status ?? '', { emitEvent: false });
        controls.serviceIds.setValue(serviceIds, { emitEvent: false });
      });
    });

    // Debounce that "Limpiar filtros" can cancel, so a keystroke typed just before never returns.
    this.form.controls.name.valueChanges
      .pipe(
        switchMap((name) =>
          timer(NAME_FILTER_DEBOUNCE_MS).pipe(
            map(() => name),
            takeUntil(this.cancelName),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((name) => this.emit({ name: name.trim() }));

    this.form.controls.status.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((status) => this.emit({ status: status || null }));

    this.form.controls.serviceIds.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((serviceIds) => this.emit({ serviceIds }));
  }

  protected clear(): void {
    this.cancelName.next();
    this.form.controls.name.setValue('', { emitEvent: false });
    this.form.controls.status.setValue('', { emitEvent: false });
    this.form.controls.serviceIds.setValue([], { emitEvent: false });
    this.filtersChange.emit(NO_EMPLOYEE_FILTERS);
  }

  private emit(changes: Partial<EmployeeFilters>): void {
    const next = { ...this.filters(), ...changes };
    if (!sameEmployeeFilters(next, this.filters())) {
      this.filtersChange.emit(next);
    }
  }
}
