import { Directive, ElementRef, forwardRef, inject } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { formatThousands } from '@shared/formatting/format';

// NUMERIC(12,2) in the backend: up to 10 whole digits.
const MAX_DIGITS = 10;

/**
 * Whole-peso amount typed as `45.000` (dot every 3 digits) while the form control holds `45000`
 * (`null` when empty). Only digits are accepted, so the value is never negative or fractional.
 * Usage: `<input appCurrencyInput formControlName="price" />` (text input, not `type="number"`).
 */
@Directive({
  selector: 'input[appCurrencyInput]',
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => CurrencyInput), multi: true },
  ],
  host: {
    inputmode: 'numeric',
    autocomplete: 'off',
    '(input)': 'onInput()',
    '(blur)': 'onTouched()',
  },
})
export class CurrencyInput implements ControlValueAccessor {
  private readonly input = inject<ElementRef<HTMLInputElement>>(ElementRef).nativeElement;
  private onChange: (value: number | null) => void = () => undefined;
  protected onTouched: () => void = () => undefined;

  writeValue(value: number | null): void {
    this.input.value =
      value === null || value === undefined || !Number.isFinite(value)
        ? ''
        : formatThousands(value);
  }

  registerOnChange(fn: (value: number | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.input.disabled = disabled;
  }

  protected onInput(): void {
    const { value, selectionStart } = this.input;
    const digitsBeforeCaret = countDigits(value.slice(0, selectionStart ?? value.length));
    const digits = value
      .replace(/\D/g, '')
      .replace(/^0+(?=\d)/, '')
      .slice(0, MAX_DIGITS);
    const amount = digits === '' ? null : Number(digits);

    this.input.value = amount === null ? '' : formatThousands(amount);
    // Reformatting moves the caret to the end; keep it after the same digit the user typed.
    const caret = caretAfterDigits(this.input.value, digitsBeforeCaret);
    this.input.setSelectionRange(caret, caret);
    this.onChange(amount);
  }
}

function countDigits(text: string): number {
  return text.replace(/\D/g, '').length;
}

function caretAfterDigits(text: string, digits: number): number {
  let seen = 0;
  for (let index = 0; index < text.length; index++) {
    if (seen === digits) {
      return index;
    }
    if (/\d/.test(text[index])) {
      seen++;
    }
  }
  return text.length;
}
