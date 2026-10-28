import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  output,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { NAME_FILTER_MAX_LENGTH } from '@shared/models/list-filter-params';
import { Icon } from '@shared/ui/icon/icon';
import { map, Subject, switchMap, takeUntil, timer } from 'rxjs';

/** HU-13 / HU-22: wait after the last keystroke before filtering by name. */
export const NAME_FILTER_DEBOUNCE_MS = 300;

/**
 * Filter bar of a list (HU-13, HU-22): the name search box and "Limpiar filtros", with the
 * list's own filters (status, multi-select…) projected in between. `name` is the source of truth
 * (the URL); the bar only emits.
 */
@Component({
  selector: 'app-filter-bar',
  imports: [ReactiveFormsModule, Icon],
  templateUrl: './filter-bar.html',
  styleUrl: './filter-bar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilterBar {
  /** Accessible name of the search landmark ("Filtrar servicios"). */
  readonly label = input.required<string>();
  /** Label and placeholder of the search box. */
  readonly searchLabel = input('Buscar por nombre');
  readonly name = input.required<string>();
  /** Some filter is in use, so "Limpiar filtros" is shown. */
  readonly canClear = input(false);

  /** Trimmed, after the debounce; it may equal the current `name`. */
  readonly nameChange = output<string>();
  readonly cleared = output<void>();

  protected readonly nameMaxLength = NAME_FILTER_MAX_LENGTH;
  protected readonly nameControl = new FormControl('', { nonNullable: true });

  private readonly cancelName = new Subject<void>();

  constructor() {
    // Follow the URL (reload, back/forward, "Limpiar filtros") without emitting again.
    effect(() => {
      const name = this.name();
      untracked(() => {
        if (this.nameControl.value.trim() !== name) {
          this.nameControl.setValue(name, { emitEvent: false });
        }
      });
    });

    // Debounce that "Limpiar filtros" can cancel, so a keystroke typed just before never returns.
    this.nameControl.valueChanges
      .pipe(
        switchMap((name) =>
          timer(NAME_FILTER_DEBOUNCE_MS).pipe(
            map(() => name),
            takeUntil(this.cancelName),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((name) => this.nameChange.emit(name.trim()));
  }

  protected clear(): void {
    this.cancelName.next();
    this.nameControl.setValue('', { emitEvent: false });
    this.cleared.emit();
  }
}
