import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  input,
  output,
  untracked,
  viewChild,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { applyServerErrors } from '@shared/forms/apply-server-errors';
import { ErrorMessages } from '@shared/forms/error-messages';
import { email } from '@shared/forms/validators/email.validator';
import { nit } from '@shared/forms/validators/nit.validator';
import { phone } from '@shared/forms/validators/phone.validator';
import { Alert } from '@shared/ui/alert/alert';
import { Button } from '@shared/ui/button/button';
import { FormField } from '@shared/ui/form-field/form-field';
import { FormFieldControl } from '@shared/ui/form-field/form-field-control';
import { Icon } from '@shared/ui/icon/icon';
import { NewBusiness, NewBusinessField } from '@features/dashboard/models/business.model';
import { OnboardingFailure } from '@features/dashboard/models/onboarding-failure';

const MESSAGES: Readonly<Record<NewBusinessField, ErrorMessages>> = {
  name: { required: 'El nombre del negocio es obligatorio' },
  address: { required: 'La dirección es obligatoria' },
  phone: { required: 'El teléfono es obligatorio', phone: 'Ingresa un teléfono válido' },
  nit: {},
  email: {},
};

/**
 * HU-03 "Registra tu negocio". Modal and mandatory: it cannot be dismissed (no close button,
 * Esc is blocked); the only way out besides registering is logging out.
 */
@Component({
  selector: 'app-business-onboarding-dialog',
  imports: [ReactiveFormsModule, Alert, Button, FormField, FormFieldControl, Icon],
  templateUrl: './business-onboarding-dialog.html',
  styleUrl: './business-onboarding-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Esc keydown bubbles from the focused field inside the dialog up to the host.
  host: { '(keydown.escape)': 'preventDismiss($event)' },
})
export class BusinessOnboardingDialog {
  readonly pending = input(false);
  readonly failure = input<OnboardingFailure | null>(null);

  readonly submitted = output<NewBusiness>();
  readonly logoutRequested = output();

  protected readonly messages = MESSAGES;
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', Validators.required],
    address: ['', Validators.required],
    phone: ['', [Validators.required, phone()]],
    nit: ['', nit()],
    email: ['', email()],
  });

  constructor() {
    afterNextRender(() => this.open());

    effect(() => {
      const failure = this.failure();
      if (failure) {
        untracked(() => applyServerErrors(this.form, failure.fieldErrors));
      }
    });
  }

  /**
   * The onboarding is mandatory. Esc fires `cancel`, but browsers with close watchers (Chrome)
   * do not always let it be cancelled, so: block Esc on keydown, cancel `cancel`, and if the
   * dialog still closes, open it again. It only goes away when the parent removes it.
   */
  protected preventDismiss(event: Event): void {
    event.preventDefault();
  }

  protected reopen(): void {
    this.open();
  }

  private open(): void {
    const dialog = this.dialog().nativeElement;
    if (dialog.open) {
      return;
    }
    // showModal() makes the rest of the page inert and traps focus inside the dialog.
    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
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
    this.submitted.emit(this.form.getRawValue());
  }
}
