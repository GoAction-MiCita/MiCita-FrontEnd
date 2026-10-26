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
import { AvatarGroup } from '@shared/ui/avatar-group/avatar-group';
import { Icon, IconName } from '@shared/ui/icon/icon';

export interface MultiSelectOption {
  readonly id: string;
  readonly name: string;
  /** Shown only with `avatars`; initials when missing. */
  readonly photoUrl?: string | null;
  /** Short tag next to the name, such as "Inactivo". */
  readonly hint?: string | null;
}

/** Visible texts, so each list speaks of its own items (employees, services…) in Spanish. */
export interface MultiSelectTexts {
  /** Trigger with nothing selected: "Seleccionar empleados". */
  readonly placeholder: string;
  /** Trigger with a selection: "2 empleados seleccionados". */
  readonly selected: (count: number) => string;
  /** Trigger when there are no options at all: "Sin empleados registrados". */
  readonly none: string;
  /** Accessible name of the chips list: "Empleados seleccionados". */
  readonly chipsLabel: string;
  /** Chip of a selected id that is not among the options: "Empleado no disponible". */
  readonly unknown: string;
  /** Accessible name of the search box: "Buscar empleado". */
  readonly search: string;
  readonly loading: string;
  readonly failed: string;
  /** Opened list without options. */
  readonly empty: string;
  /** Search without matches. */
  readonly noMatches: string;
}

let nextId = 0;

/**
 * Multi-select with search (HU-12, generalised in HU-17). Form control value: the selected ids.
 * Esc or a click outside closes the list without closing a surrounding <dialog>.
 */
@Component({
  selector: 'app-multi-select',
  imports: [AvatarGroup, Icon],
  templateUrl: './multi-select.html',
  styleUrl: './multi-select.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => MultiSelect), multi: true },
  ],
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(keydown.escape)': 'onEscape($event)',
  },
})
export class MultiSelect implements ControlValueAccessor {
  readonly label = input.required<string>();
  readonly texts = input.required<MultiSelectTexts>();
  readonly icon = input<IconName>('layout-grid');
  /** Photo or initials before each option (people). */
  readonly avatars = input(false, { transform: booleanAttribute });
  readonly optional = input(false, { transform: booleanAttribute });
  /** Keeps the label for screen readers only (compact filter bar). */
  readonly hideLabel = input(false, { transform: booleanAttribute });
  /** Selected options as removable chips under the label (the filter bar only shows a count). */
  readonly showChips = input(true, { transform: booleanAttribute });
  readonly options = input<readonly MultiSelectOption[]>([]);
  readonly loading = input(false);
  readonly failed = input(false);
  /** Ids the backend rejected (400): marked in the list and in the chips. */
  readonly rejectedIds = input<readonly string[]>([]);
  readonly error = input<string | null>(null);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  protected readonly ids = {
    label: `app-multi-select-${nextId}-label`,
    trigger: `app-multi-select-${nextId}-trigger`,
    list: `app-multi-select-${nextId}-list`,
    error: `app-multi-select-${nextId++}-error`,
  };

  protected readonly open = signal(false);
  protected readonly query = signal('');
  protected readonly selected = signal<readonly string[]>([]);
  protected readonly disabled = signal(false);
  private onChange: (ids: readonly string[]) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  private readonly byId = computed(
    () => new Map(this.options().map((option) => [option.id, option])),
  );

  protected readonly visibleOptions = computed(() => {
    const query = normalize(this.query());
    const selected = new Set(this.selected());
    const rejected = new Set(this.rejectedIds());
    return this.options()
      .filter((option) => normalize(option.name).includes(query))
      .map((option) => ({
        id: option.id,
        name: option.name,
        hint: option.hint ?? null,
        people: [{ id: option.id, name: option.name, photoUrl: option.photoUrl ?? null }],
        checked: selected.has(option.id),
        rejected: rejected.has(option.id),
      }));
  });

  protected readonly chips = computed(() => {
    const rejected = new Set(this.rejectedIds());
    return this.selected().map((id) => {
      const name = this.byId().get(id)?.name ?? this.texts().unknown;
      return { id, name, rejected: rejected.has(id), removeLabel: `Quitar ${name}` };
    });
  });

  protected readonly triggerText = computed(() => {
    const count = this.selected().length;
    if (count > 0) {
      return this.texts().selected(count);
    }
    if (!this.loading() && !this.failed() && this.options().length === 0) {
      return this.texts().none;
    }
    return this.texts().placeholder;
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
