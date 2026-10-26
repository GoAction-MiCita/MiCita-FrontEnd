import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Fails with `{ required: true }` for text made only of whitespace, which the backend trims to an
 * empty value (Validators.required accepts it). Reusing the `required` key keeps the field's
 * "obligatorio" message. Empty values are left to `Validators.required`, which also marks the field
 * as required (asterisk and aria-required).
 */
export function notBlank(): ValidatorFn {
  return (control: AbstractControl<string | null>): ValidationErrors | null => {
    const value = control.value;
    if (typeof value !== 'string' || value === '') {
      return null;
    }
    return value.trim() === '' ? { required: true } : null;
  };
}
