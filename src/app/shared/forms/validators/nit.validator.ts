import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

// Colombian NIT: 6–10 digits (dots as thousands separators allowed) and an optional check digit
// after a dash, e.g. `900.123.456-7` or `900123456`. The check digit itself is validated by the
// backend; here we only catch typos early.
const NIT_PATTERN = /^\d{6,10}(-\d)?$/;

/** Fails with `{ nit: true }`. Empty values are valid (the NIT is optional). */
export function nit(): ValidatorFn {
  return (control: AbstractControl<string | null>): ValidationErrors | null => {
    const value = (control.value ?? '').trim();
    if (value === '') {
      return null;
    }
    return NIT_PATTERN.test(value.replace(/\./g, '')) ? null : { nit: true };
  };
}
