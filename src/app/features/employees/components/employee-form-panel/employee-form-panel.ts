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
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  EMPLOYEE_FORM_MESSAGES,
  EmployeeFormFailure,
} from '@features/employees/models/employee-form-failure';
import {
  EMPLOYEE_STATUS,
  EmployeeStatus,
  NewEmployee,
  NewEmployeeField,
  ServiceOption,
} from '@features/employees/models/employee.model';
import { SERVICE_PICKER_TEXTS } from '@features/employees/models/service-picker-texts';
import { applyServerErrors } from '@shared/forms/apply-server-errors';
import { ErrorMessages } from '@shared/forms/error-messages';
import { email } from '@shared/forms/validators/email.validator';
import { notBlank } from '@shared/forms/validators/not-blank.validator';
import { phone } from '@shared/forms/validators/phone.validator';
import { Alert } from '@shared/ui/alert/alert';
import { Button } from '@shared/ui/button/button';
import { FormField } from '@shared/ui/form-field/form-field';
import { FormFieldControl } from '@shared/ui/form-field/form-field-control';
import { Icon } from '@shared/ui/icon/icon';
import { MultiSelect, MultiSelectOption } from '@shared/ui/multi-select/multi-select';
import { SidePanel } from '@shared/ui/side-panel/side-panel';
import { map } from 'rxjs';

/** HU-17 Back: first and last name, 1 to 100 characters. */
export const NAME_MAX_LENGTH = 100;

const MESSAGES: Readonly<Record<NewEmployeeField, ErrorMessages>> = {
  firstName: {
    required: 'El nombre es obligatorio',
    maxlength: `El nombre debe tener máximo ${NAME_MAX_LENGTH} caracteres`,
  },
  lastName: {
    required: 'El apellido es obligatorio',
    maxlength: `El apellido debe tener máximo ${NAME_MAX_LENGTH} caracteres`,
  },
  phone: {},
  email: {},
  status: { required: 'Selecciona el estado' },
  serviceIds: {},
};

/**
 * HU-17 "Agregar empleado" inside a `SidePanel`, with the personal and work sections of the
 * mockup (only the fields of the contract). The panel closes with Esc, the X or "Cancelar"
 * (emits `closed`); the parent removes it. HU-18 reuses it to edit.
 */
@Component({
  selector: 'app-employee-form-panel',
  imports: [
    ReactiveFormsModule,
    Alert,
    Button,
    FormField,
    FormFieldControl,
    Icon,
    MultiSelect,
    SidePanel,
  ],
  templateUrl: './employee-form-panel.html',
  styleUrl: './employee-form-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmployeeFormPanel {
  readonly pending = input(false);
  readonly failure = input<EmployeeFormFailure | null>(null);
  /** Services of the business offered by the picker. */
  readonly services = input<readonly ServiceOption[]>([]);
  readonly servicesLoading = input(false);
  readonly servicesFailed = input(false);

  readonly submitted = output<NewEmployee>();
  readonly closed = output();

  protected readonly messages = MESSAGES;
  protected readonly status = EMPLOYEE_STATUS;
  protected readonly servicePickerTexts = SERVICE_PICKER_TEXTS;
  protected readonly nameMaxLength = NAME_MAX_LENGTH;

  protected readonly form = inject(NonNullableFormBuilder).group({
    firstName: ['', [Validators.required, notBlank(), Validators.maxLength(NAME_MAX_LENGTH)]],
    lastName: ['', [Validators.required, notBlank(), Validators.maxLength(NAME_MAX_LENGTH)]],
    phone: ['', phone()],
    email: ['', email()],
    // Preselected "Activo" (HU-17 note).
    status: [EMPLOYEE_STATUS.active as EmployeeStatus, Validators.required],
    serviceIds: [[] as readonly string[]],
  });

  /** Inactive services can be assigned too; they carry an "Inactivo" tag. */
  protected readonly serviceOptions = computed<readonly MultiSelectOption[]>(() =>
    this.services().map((service) => ({
      id: service.id,
      name: service.name,
      hint: service.active ? null : 'Inactivo',
    })),
  );

  // The server error stays on the control until the selection changes (Angular revalidates).
  protected readonly servicesError = toSignal(
    this.form.controls.serviceIds.events.pipe(
      map(() => (this.form.controls.serviceIds.errors?.['server'] as string | undefined) ?? null),
    ),
    { initialValue: null },
  );
  protected readonly rejectedServiceIds = computed(() =>
    this.servicesError() ? (this.failure()?.rejectedServiceIds ?? []) : [],
  );

  /** A 400 whose field errors match no control: "Revisa los campos marcados" would point at nothing. */
  private readonly nothingMarked = signal(false);
  protected readonly failureSummary = computed(() =>
    this.nothingMarked() ? EMPLOYEE_FORM_MESSAGES.unexpected : (this.failure()?.summary ?? ''),
  );

  constructor() {
    effect(() => {
      const failure = this.failure();
      if (failure) {
        const unmatched = untracked(() => applyServerErrors(this.form, failure.fieldErrors));
        const marked = Object.keys(failure.fieldErrors).length - unmatched.length;
        this.nothingMarked.set(
          failure.summary === EMPLOYEE_FORM_MESSAGES.checkFields && marked === 0,
        );
      } else {
        this.nothingMarked.set(false);
      }
    });
  }

  protected submit(): void {
    if (this.pending()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.submitted.emit({
      ...value,
      phone: value.phone.trim() || null,
      email: value.email.trim() || null,
    });
  }
}
