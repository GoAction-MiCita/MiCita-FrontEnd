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
import { CurrencyInput } from '@shared/directives/currency-input';
import { applyServerErrors } from '@shared/forms/apply-server-errors';
import { ErrorMessages } from '@shared/forms/error-messages';
import { integer } from '@shared/forms/validators/integer.validator';
import { Alert } from '@shared/ui/alert/alert';
import { Button } from '@shared/ui/button/button';
import { FormField } from '@shared/ui/form-field/form-field';
import { FormFieldControl } from '@shared/ui/form-field/form-field-control';
import { Icon } from '@shared/ui/icon/icon';
import { ServiceFormFailure } from '@features/services/models/service-form-failure';
import {
  NewService,
  NewServiceField,
  SERVICE_STATUS,
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
};

/**
 * HU-09 "Agregar servicio": side panel on desktop, full screen on mobile.
 * Closes with Esc, the X or "Cancelar" (emits `closed`); the parent removes it.
 */
@Component({
  selector: 'app-service-form-panel',
  imports: [ReactiveFormsModule, Alert, Button, CurrencyInput, FormField, FormFieldControl, Icon],
  templateUrl: './service-form-panel.html',
  styleUrl: './service-form-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceFormPanel {
  readonly pending = input(false);
  readonly failure = input<ServiceFormFailure | null>(null);

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
  });

  private readonly description = toSignal(this.form.controls.description.valueChanges, {
    initialValue: '',
  });
  protected readonly descriptionCount = computed(
    () => `${this.description().length}/${DESCRIPTION_MAX_LENGTH}`,
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
    this.submitted.emit({ ...value, description: value.description || null });
  }
}
