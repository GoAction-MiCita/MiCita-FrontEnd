import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  forwardRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { ServiceEmployee } from '@features/services/models/service.model';
import { AvatarGroup } from '@shared/ui/avatar-group/avatar-group';
import { Icon } from '@shared/ui/icon/icon';

let nextId = 0;

/**
 * HU-12 multi-select of business employees (photo or initials and name), with search.
 * Form control value: the selected ids. Used by the service form and the HU-13 filter bar.
 * Esc or a click outside closes the list without closing a surrounding <dialog>.
 */
@Component({
  selector: 'app-employee-picker',
  imports: [AvatarGroup, Icon],
  templateUrl: './employee-picker.html',
  styleUrl: './employee-picker.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => EmployeePicker), multi: true },
  ],
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(keydown.escape)': 'onEscape($event)',
  },
})
export class EmployeePicker implements ControlValueAccessor {
  readonly label = input('Empleados');
  readonly optional = input(false, { transform: booleanAttribute });
  /** Keeps the label for screen readers only (compact filter bar). */
  readonly hideLabel = input(false, { transform: booleanAttribute });
  /** Selected employees as removable chips under the label (the filter bar only shows a count). */
  readonly showChips = input(true, { transform: booleanAttribute });
  readonly employees = input<readonly ServiceEmployee[]>([]);
  readonly loading = input(false);
  readonly failed = input(false);
  /** Ids the backend rejected (400): marked in the list and in the chips. */
  readonly rejectedIds = input<readonly string[]>([]);
  readonly error = input<string | null>(null);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  protected readonly ids = {
    label: `app-employee-picker-${nextId}-label`,
    trigger: `app-employee-picker-${nextId}-trigger`,
    list: `app-employee-picker-${nextId}-list`,
    error: `app-employee-picker-${nextId++}-error`,
  };

  protected readonly open = signal(false);
  protected readonly query = signal('');
  protected readonly selected = signal<readonly string[]>([]);
  protected readonly disabled = signal(false);
  private onChange: (ids: readonly string[]) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  private readonly byId = computed(
    () => new Map(this.employees().map((employee) => [employee.id, employee])),
  );

  protected readonly options = computed(() => {
    const query = normalize(this.query());
    const selected = new Set(this.selected());
    const rejected = new Set(this.rejectedIds());
    return this.employees()
      .filter((employee) => normalize(employee.name).includes(query))
      .map((employee) => ({
        id: employee.id,
        name: employee.name,
        people: [employee],
        checked: selected.has(employee.id),
        rejected: rejected.has(employee.id),
      }));
  });

  protected readonly chips = computed(() => {
    const rejected = new Set(this.rejectedIds());
    return this.selected().map((id) => {
      const name = this.byId().get(id)?.name ?? 'Empleado no disponible';
      return { id, name, rejected: rejected.has(id), removeLabel: `Quitar a ${name}` };
    });
  });

  protected readonly triggerText = computed(() => {
    const count = this.selected().length;
    if (count > 0) {
      return count === 1 ? '1 empleado seleccionado' : `${count} empleados seleccionados`;
    }
    if (!this.loading() && !this.failed() && this.employees().length === 0) {
      return 'Sin empleados registrados';
    }
    return 'Seleccionar empleados';
  });

  protected readonly invalid = computed(
    () => this.error() !== null || this.rejectedIds().length > 0,
  );

  writeValue(ids: readonly string[] | null): void {
    this.selected.set(ids ?? []);
  }

  registerOnChange(fn: (ids: readonly string[]) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
    if (disabled) {
      this.open.set(false);
    }
  }

  protected toggleOpen(): void {
    this.open.update((open) => !open);
    if (!this.open()) {
      this.onTouched();
    }
  }

  protected search(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected toggle(id: string): void {
    const selected = this.selected();
    this.update(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]);
  }

  protected remove(id: string): void {
    this.update(this.selected().filter((item) => item !== id));
  }

  protected onDocumentClick(event: Event): void {
    if (this.open() && !this.host.contains(event.target as Node | null)) {
      this.close();
    }
  }

  /** Closes only the list: Esc must not also close the dialog the picker lives in. */
  protected onEscape(event: Event): void {
    if (this.open()) {
      event.preventDefault();
      event.stopPropagation();
      this.close();
      this.host.querySelector<HTMLButtonElement>(`#${this.ids.trigger}`)?.focus();
    }
  }

  private close(): void {
    this.open.set(false);
    this.query.set('');
    this.onTouched();
  }

  private update(ids: readonly string[]): void {
    this.selected.set(ids);
    this.onChange(ids);
  }
}

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('es-CO')
    .trim();
}
