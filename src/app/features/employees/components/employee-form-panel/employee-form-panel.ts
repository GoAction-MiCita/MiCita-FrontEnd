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
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { EmployeeFormFailure } from '@features/employees/models/employee-form-failure';
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
 * HU-17 "Agregar empleado": side panel on desktop, full screen on mobile, with the personal and
 * work sections of the mockup (only the fields of the contract). Closes with Esc, the X or
 * "Cancelar" (emits `closed`); the parent removes it. HU-18 reuses it to edit.
 */
@Component({
  selector: 'app-employee-form-panel',
  imports: [ReactiveFormsModule, Alert, Button, FormField, FormFieldControl, Icon, MultiSelect],
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
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

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
