import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  signal,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HOME_PATH } from '@core/auth/auth-guard';
import { LoginStore } from '@features/auth/data-access/login-store';
import { ErrorMessages } from '@shared/forms/error-messages';
import { Alert } from '@shared/ui/alert/alert';
import { Button } from '@shared/ui/button/button';
import { FormField } from '@shared/ui/form-field/form-field';
import { FormFieldControl } from '@shared/ui/form-field/form-field-control';
import { Icon } from '@shared/ui/icon/icon';

const MESSAGES: Readonly<Record<'identifier' | 'password', ErrorMessages>> = {
  identifier: { required: 'Ingresa tu usuario o correo electrónico' },
  password: { required: 'Ingresa tu contraseña' },
};

/** HU-02 · Autenticación de usuario (public). */
@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule, RouterLink, Alert, Button, FormField, FormFieldControl, Icon],
  providers: [LoginStore],
  templateUrl: './login-page.html',
  styleUrl: './login-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class LoginPage {
  protected readonly store = inject(LoginStore);
  private readonly router = inject(Router);

  /** `?registered=true`: set by RegisterPage after a 201. */
  readonly registered = input(false, { transform: booleanAttribute });
  /** `?expired=true`: set by AuthSession when the refresh token is rejected. */
  readonly expired = input(false, { transform: booleanAttribute });
  /** `?returnUrl=…`: set by authGuard with the private page the user tried to open. */
  readonly returnUrl = input<string>();

  protected readonly messages = MESSAGES;
  protected readonly showPassword = signal(false);
  protected readonly showForgotNotice = signal(false);

  protected readonly form = inject(NonNullableFormBuilder).group({
    identifier: ['', Validators.required],
    password: ['', Validators.required],
    remember: [false],
  });

  protected togglePassword(): void {
    this.showPassword.update((visible) => !visible);
  }

  protected toggleForgotNotice(): void {
    this.showForgotNotice.update((visible) => !visible);
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { identifier, password, remember } = this.form.getRawValue();
    const user = await this.store.login({ identifier, password }, remember);
    if (user) {
      await this.router.navigateByUrl(this.destination());
    }
  }

  private destination(): string {
    const returnUrl = this.returnUrl();
    // Only internal paths: never redirect to another origin (`//evil.com`) or back to /auth.
    if (
      returnUrl?.startsWith('/') &&
      !returnUrl.startsWith('//') &&
      !returnUrl.startsWith('/auth')
    ) {
      return returnUrl;
    }
    // Users without a business get the onboarding dialog on the dashboard (HU-03).
    return HOME_PATH;
  }
}
