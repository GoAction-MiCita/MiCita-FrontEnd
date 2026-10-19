import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

// Stricter than Validators.email: requires a domain with a dot and a TLD (rejects `ana@correo`).
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[^\s@.]{2,}$/;

/** Fails with `{ email: true }`. Empty values are left to `Validators.required`. */
export function email(): ValidatorFn {
  return (control: AbstractControl<string | null>): ValidationErrors | null => {
    const value = (control.value ?? '').trim();
    return value === '' || EMAIL_PATTERN.test(value) ? null : { email: true };
  };
}
