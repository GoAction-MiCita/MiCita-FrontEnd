import { FormGroup } from '@angular/forms';
import { FieldErrors } from '@shared/models/field-errors.model';

/**
 * Sets each server message as a `server` error on the matching control.
 * Returns the field names without a matching control, so the caller can show them globally.
 */
export function applyServerErrors(form: FormGroup, fieldErrors: FieldErrors): string[] {
  const unmatched: string[] = [];
  for (const [field, message] of Object.entries(fieldErrors)) {
    const control = form.get(field);
    if (control) {
      control.setErrors({ ...control.errors, server: message });
      control.markAsTouched();
    } else {
      unmatched.push(field);
    }
  }
  return unmatched;
}
