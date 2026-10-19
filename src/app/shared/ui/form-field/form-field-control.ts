import { Directive, inject } from '@angular/core';
import { FormField } from './form-field';

/**
 * Marks the input projected into `app-form-field`: links it to the label, hint and error
 * (id, aria-describedby, aria-invalid). Visual reset lives in `styles/base/_forms.scss`.
 */
@Directive({
  selector: '[appFormFieldControl]',
  host: {
    class: 'form-field-control',
    '[id]': 'field.controlId',
    '[attr.aria-invalid]': 'field.invalid()',
    '[attr.aria-describedby]': 'field.describedBy()',
    '[attr.aria-required]': 'field.required() || null',
  },
})
export class FormFieldControl {
  protected readonly field = inject(FormField);
}
