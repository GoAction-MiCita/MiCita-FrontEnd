import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { applyServerErrors } from '@shared/forms/apply-server-errors';
import { ErrorMessages } from '@shared/forms/error-messages';
import { email } from '@shared/forms/validators/email.validator';
import { notBlank } from '@shared/forms/validators/not-blank.validator';
import { passwordStrength } from '@shared/forms/validators/password-strength.validator';
import { phone } from '@shared/forms/validators/phone.validator';
import { Alert } from '@shared/ui/alert/alert';
import { Button } from '@shared/ui/button/button';
import { FormField } from '@shared/ui/form-field/form-field';
import { FormFieldControl } from '@shared/ui/form-field/form-field-control';
import { Icon } from '@shared/ui/icon/icon';
import { PasswordRules } from '@shared/ui/password-rules/password-rules';
import { RegisterStore } from '@features/auth/data-access/register-store';
import { NewUserField } from '@features/auth/models/user.model';

const REQUIRED_MESSAGES: Readonly<Record<NewUserField, ErrorMessages>> = {
  firstName: { required: 'El nombre es obligatorio' },
  lastName: { required: 'El apellido es obligatorio' },
  address: { required: 'La dirección es obligatoria' },
  phone: { required: 'El teléfono es obligatorio' },
  email: { required: 'El correo es obligatorio' },
  username: { required: 'El nombre de usuario es obligatorio' },
  password: { required: 'La contraseña es obligatoria' },
};

// Mirrors the backend `RegisterUserRequest` limits (Swagger); the password limit is in its validator.
const MAX_LENGTH = {
  firstName: 100,
  lastName: 100,
  address: 255,
  email: 254,
  username: 50,
} as const;

/** HU-01 · Registro de usuario (public). */
@Component({
  selector: 'app-register-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    Alert,
    Button,
    FormField,
    FormFieldControl,
    Icon,
    PasswordRules,
  ],
  providers: [RegisterStore],
  templateUrl: './register-page.html',
  styleUrl: './register-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class RegisterPage {
  protected readonly store = inject(RegisterStore);
  private readonly router = inject(Router);

  protected readonly messages = REQUIRED_MESSAGES;
  protected readonly passwordHint =
    'Mínimo 6 caracteres, con minúsculas, mayúsculas y un carácter especial.';

  protected readonly form = inject(NonNullableFormBuilder).group({
    firstName: ['', [Validators.required, notBlank(), Validators.maxLength(MAX_LENGTH.firstName)]],
    lastName: ['', [Validators.required, notBlank(), Validators.maxLength(MAX_LENGTH.lastName)]],
    address: ['', [Validators.required, notBlank(), Validators.maxLength(MAX_LENGTH.address)]],
    phone: ['', [Validators.required, phone()]],
    email: ['', [Validators.required, email(), Validators.maxLength(MAX_LENGTH.email)]],
    username: ['', [Validators.required, notBlank(), Validators.maxLength(MAX_LENGTH.username)]],
    password: ['', [Validators.required, passwordStrength()]],
  });

  protected readonly password = toSignal(this.form.controls.password.valueChanges, {
    initialValue: '',
  });
  protected readonly showPassword = signal(false);

  protected togglePassword(): void {
    this.showPassword.update((visible) => !visible);
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const created = await this.store.register(this.form.getRawValue());
    if (created) {
      await this.router.navigate(['/auth/login'], { queryParams: { registered: true } });
      return;
    }
    applyServerErrors(this.form, this.store.failure()?.fieldErrors ?? {});
  }
}
