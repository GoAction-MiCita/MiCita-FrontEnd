import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Fails with `{ integer: true }` for non-whole numbers (e.g. 12.5) or non-numeric text.
 * Empty values are left to `Validators.required`; ranges to `Validators.min`/`max`.
 */
export function integer(): ValidatorFn {
  return (control: AbstractControl<number | string | null>): ValidationErrors | null => {
    const value = control.value;
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const number = typeof value === 'number' ? value : Number(String(value).trim());
    return Number.isInteger(number) ? null : { integer: true };
  };
}
