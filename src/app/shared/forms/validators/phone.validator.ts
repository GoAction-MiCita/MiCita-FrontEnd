import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

// Mirrors the backend rule: optional `+` and 7–15 digits. Spaces, dashes and parentheses are
// allowed for readability (the mapper strips them before sending).
const PHONE_PATTERN = /^\+?\d{7,15}$/;

/** Fails with `{ phone: true }`. Empty values are left to `Validators.required`. */
export function phone(): ValidatorFn {
  return (control: AbstractControl<string | null>): ValidationErrors | null => {
    const value = (control.value ?? '').trim();
    if (value === '') {
      return null;
    }
    return PHONE_PATTERN.test(value.replace(/[\s\-()]/g, '')) ? null : { phone: true };
  };
}
