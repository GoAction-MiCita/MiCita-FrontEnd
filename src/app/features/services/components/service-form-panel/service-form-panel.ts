import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CurrencyInput } from '@shared/directives/currency-input';
import { applyServerErrors } from '@shared/forms/apply-server-errors';
import { ErrorMessages } from '@shared/forms/error-messages';
import { integer } from '@shared/forms/validators/integer.validator';
import { notBlank } from '@shared/forms/validators/not-blank.validator';
import { Alert } from '@shared/ui/alert/alert';
import { Button } from '@shared/ui/button/button';
import { FormField } from '@shared/ui/form-field/form-field';
import { FormFieldControl } from '@shared/ui/form-field/form-field-control';
import { Icon } from '@shared/ui/icon/icon';
import { SidePanel } from '@shared/ui/side-panel/side-panel';
import { EMPLOYEE_PICKER_TEXTS } from '@features/services/models/employee-picker-texts';
import { MultiSelect } from '@shared/ui/multi-select/multi-select';
import {
  SERVICE_FORM_MESSAGES,
  ServiceFormFailure,
} from '@features/services/models/service-form-failure';
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
 * HU-09 "Agregar servicio" and HU-10 "Editar servicio" inside a `SidePanel`, which closes with
 * Esc, the X or "Cancelar" (emits `closed`); the parent removes it.
 * In edit mode the form waits for `service`. Employees are chosen with the HU-12 picker.
 */
@Component({
  selector: 'app-service-form-panel',
  imports: [
    ReactiveFormsModule,
    Alert,
    Button,
    CurrencyInput,
    MultiSelect,
    FormField,
    FormFieldControl,
    Icon,
    SidePanel,
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
  protected readonly employeePickerTexts = EMPLOYEE_PICKER_TEXTS;
  protected readonly status = SERVICE_STATUS;

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, notBlank()]],
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

  /** A 400 whose field errors match no control: "Revisa los campos marcados" would point at nothing. */
  private readonly nothingMarked = signal(false);
  protected readonly failureSummary = computed(() =>
    this.nothingMarked() ? SERVICE_FORM_MESSAGES.unexpected : (this.failure()?.summary ?? ''),
  );

  constructor() {
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
        const unmatched = untracked(() => applyServerErrors(this.form, failure.fieldErrors));
        const marked = Object.keys(failure.fieldErrors).length - unmatched.length;
        this.nothingMarked.set(
          failure.summary === SERVICE_FORM_MESSAGES.checkFields && marked === 0,
        );
      } else {
        this.nothingMarked.set(false);
      }
    });
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
