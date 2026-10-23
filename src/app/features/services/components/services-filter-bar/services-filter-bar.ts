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
  hasServiceFilters,
  NO_SERVICE_FILTERS,
  sameServiceFilters,
  ServiceFilters,
} from '@features/services/models/service-filters';
import { SERVICE_STATUS, ServiceStatus } from '@features/services/models/service.model';
import { Icon } from '@shared/ui/icon/icon';
import { map, Subject, switchMap, takeUntil, timer } from 'rxjs';

/** HU-13: wait after the last keystroke before filtering by name. */
export const NAME_FILTER_DEBOUNCE_MS = 300;

/**
 * Filter bar of the services list (HU-13): name and status. `filters` is the source of truth
 * (the URL); the bar only emits `filtersChange`. Employees filter: with the HU-12 selector.
 */
@Component({
  selector: 'app-services-filter-bar',
  imports: [ReactiveFormsModule, Icon],
  templateUrl: './services-filter-bar.html',
  styleUrl: './services-filter-bar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServicesFilterBar {
  readonly filters = input.required<ServiceFilters>();
  readonly filtersChange = output<ServiceFilters>();

  protected readonly status = SERVICE_STATUS;
  protected readonly canClear = computed(() => hasServiceFilters(this.filters()));

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: [''],
    status: ['' as ServiceStatus | ''],
  });

  private readonly cancelName = new Subject<void>();

  constructor() {
    // Follow the URL (reload, back/forward, "Limpiar filtros") without emitting again.
    effect(() => {
      const { name, status } = this.filters();
      untracked(() => {
        const controls = this.form.controls;
        if (controls.name.value.trim() !== name) {
          controls.name.setValue(name, { emitEvent: false });
        }
        controls.status.setValue(status ?? '', { emitEvent: false });
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
  }

  protected clear(): void {
    this.cancelName.next();
    this.form.controls.name.setValue('', { emitEvent: false });
    this.form.controls.status.setValue('', { emitEvent: false });
    this.filtersChange.emit(NO_SERVICE_FILTERS);
  }

  private emit(changes: Partial<ServiceFilters>): void {
    const next = { ...this.filters(), ...changes };
    if (!sameServiceFilters(next, this.filters())) {
      this.filtersChange.emit(next);
    }
  }
}
