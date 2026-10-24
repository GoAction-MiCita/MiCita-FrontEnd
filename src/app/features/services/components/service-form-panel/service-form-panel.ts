import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  DOCUMENT,
  effect,
  ElementRef,
  inject,
  input,
  output,
  untracked,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CurrencyInput } from '@shared/directives/currency-input';
import { applyServerErrors } from '@shared/forms/apply-server-errors';
import { ErrorMessages } from '@shared/forms/error-messages';
import { integer } from '@shared/forms/validators/integer.validator';
import { Alert } from '@shared/ui/alert/alert';
import { Button } from '@shared/ui/button/button';
import { FormField } from '@shared/ui/form-field/form-field';
import { FormFieldControl } from '@shared/ui/form-field/form-field-control';
import { Icon } from '@shared/ui/icon/icon';
import { EmployeePicker } from '@features/services/components/employee-picker/employee-picker';
import { ServiceFormFailure } from '@features/services/models/service-form-failure';
import {
  NewService,
  NewServiceField,
  SERVICE_STATUS,
  Service,
  ServiceEmployee,
  ServiceStatus,
} from '@features/services/models/service.model';

const DESCRIPTION_MAX_LENGTH = 120;

const MESSAGES: Readonly<Record<NewServiceField, ErrorMessages>> = {
  name: { required: 'El nombre del servicio es obligatorio' },
  description: {},
  durationMinutes: {
    min: 'La duración debe ser mayor a 0 minutos',
    integer: 'Ingresa la duración en minutos enteros',
  },
  price: {
    min: 'El precio no puede ser negativo',
    integer: 'Ingresa el precio en pesos, sin decimales',
  },
  status: { required: 'Selecciona el estado' },
  employeeIds: {},
};

export type ServiceFormMode = 'create' | 'edit';

/**
 * HU-09 "Agregar servicio" and HU-10 "Editar servicio": side panel on desktop, full screen on
 * mobile. Closes with Esc, the X or "Cancelar" (emits `closed`); the parent removes it.
 * In edit mode the form waits for `service`. Employees are chosen with the HU-12 picker.
 */
@Component({
  selector: 'app-service-form-panel',
  imports: [
    ReactiveFormsModule,
    Alert,
    Button,
    CurrencyInput,
    EmployeePicker,
    FormField,
    FormFieldControl,
    Icon,
  ],
  templateUrl: './service-form-panel.html',
  styleUrl: './service-form-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceFormPanel {
  readonly mode = input<ServiceFormMode>('create');
  /** Edit mode: the service to edit, `null` while it loads or if it could not be loaded. */
  readonly service = input<Service | null>(null);
  readonly loading = input(false);
  readonly pending = input(false);
  readonly failure = input<ServiceFormFailure | null>(null);
  /** HU-12: employees of the business offered by the picker. */
  readonly employees = input<readonly ServiceEmployee[]>([]);
  readonly employeesLoading = input(false);
  readonly employeesFailed = input(false);

  readonly submitted = output<NewService>();
  readonly closed = output();

  protected readonly messages = MESSAGES;
  protected readonly status = SERVICE_STATUS;
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', Validators.required],
    description: ['', Validators.maxLength(DESCRIPTION_MAX_LENGTH)],
    durationMinutes: [null as number | null, [Validators.min(1), integer()]],
    price: [null as number | null, [Validators.min(0), integer()]],
    status: [SERVICE_STATUS.active as ServiceStatus, Validators.required],
    employeeIds: [[] as readonly string[]],
  });

  private readonly description = toSignal(this.form.controls.description.valueChanges, {
    initialValue: '',
  });
  protected readonly descriptionCount = computed(
    () => `${this.description().length}/${DESCRIPTION_MAX_LENGTH}`,
  );

  protected readonly editing = computed(() => this.mode() === 'edit');
  protected readonly title = computed(() =>
    this.editing() ? 'Editar servicio' : 'Agregar servicio',
  );
  /** In edit mode there is nothing to show or save until the service arrives. */
  protected readonly ready = computed(() => !this.editing() || this.service() !== null);
  /** The business list plus employees already in the service but missing from it (e.g. removed). */
  protected readonly employeeOptions = computed(() => {
    const listed = this.employees();
    const known = new Set(listed.map((employee) => employee.id));
    const extra = (this.service()?.employees ?? []).filter((employee) => !known.has(employee.id));
    return [...listed, ...extra];
  });

  // The server error stays on the control until the selection changes (Angular revalidates).
  protected readonly employeesError = toSignal(
    this.form.controls.employeeIds.events.pipe(
      map(() => (this.form.controls.employeeIds.errors?.['server'] as string | undefined) ?? null),
    ),
    { initialValue: null },
  );
  protected readonly rejectedEmployeeIds = computed(() =>
    this.employeesError() ? (this.failure()?.rejectedEmployeeIds ?? []) : [],
  );

  constructor() {
    // Give focus back to the button that opened the panel.
    const opener = inject(DOCUMENT).activeElement;
    inject(DestroyRef).onDestroy(() => {
      if (opener instanceof HTMLElement && opener.isConnected) {
        opener.focus();
      }
    });

    afterNextRender(() => this.open());

    effect(() => {
      const service = this.service();
      if (service) {
        untracked(() =>
          this.form.reset({
            name: service.name,
            description: service.description ?? '',
            durationMinutes: service.durationMinutes,
            price: service.price,
            status: service.status,
            employeeIds: service.employees.map((employee) => employee.id),
          }),
        );
      }
    });

    effect(() => {
      const failure = this.failure();
      if (failure) {
        untracked(() => applyServerErrors(this.form, failure.fieldErrors));
      }
    });
  }

  private open(): void {
    const dialog = this.dialog().nativeElement;
    // showModal() makes the rest of the page inert and traps focus inside the panel.
    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  /** Esc must not drop a request in flight. */
  protected onCancel(event: Event): void {
    if (this.pending()) {
      event.preventDefault();
    }
  }

  protected close(): void {
    if (this.pending()) {
      return;
    }
    const dialog = this.dialog().nativeElement;
    // close() fires the `close` event, which emits `closed`.
    if (typeof dialog.close === 'function') {
      dialog.close();
    } else {
      this.closed.emit();
    }
  }

  protected submit(): void {
    if (this.pending() || !this.ready()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.submitted.emit({ ...value, description: value.description || null });
  }
}
