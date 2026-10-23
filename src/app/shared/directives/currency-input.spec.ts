import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { CurrencyInput } from './currency-input';

@Component({
  imports: [ReactiveFormsModule, CurrencyInput],
  template: `<input appCurrencyInput aria-label="Precio" [formControl]="price" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Host {
  readonly price = new FormControl<number | null>(null);
}

async function render() {
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  const input = (fixture.nativeElement as HTMLElement).querySelector('input')!;
  const type = (value: string, caret = value.length) => {
    input.value = value;
    input.setSelectionRange(caret, caret);
    input.dispatchEvent(new Event('input'));
  };
  return { fixture, input, type, price: fixture.componentInstance.price };
}

describe('CurrencyInput', () => {
  it.each([
    ['45000', '45.000', 45000],
    ['1500', '1.500', 1500],
    ['1234567', '1.234.567', 1234567],
    ['0', '0', 0],
    ['007', '7', 7],
  ])('shows %s as %s and stores the number', async (typed, shown, value) => {
    const { input, type, price } = await render();

    type(typed);

    expect(input.value).toBe(shown);
    expect(price.value).toBe(value);
  });

  it('ignores anything that is not a digit (sign, letters, separators)', async () => {
    const { input, type, price } = await render();

    type('-$ 45.000abc');

    expect(input.value).toBe('45.000');
    expect(price.value).toBe(45000);
  });

  it('stores null when emptied', async () => {
    const { input, type, price } = await render();

    type('45000');
    type('');

    expect(input.value).toBe('');
    expect(price.value).toBeNull();
  });

  it('caps the amount at 10 digits', async () => {
    const { type, price } = await render();

    type('123456789012');

    expect(price.value).toBe(1234567890);
  });

  it('formats a value set from code', async () => {
    const { fixture, input, price } = await render();

    price.setValue(85000);
    await fixture.whenStable();

    expect(input.value).toBe('85.000');
  });

  it('keeps the caret after the digit just typed', async () => {
    const { input, type } = await render();

    type('4.5000', 1); // typed "4" before "5.000" → "45.000", caret after the 4

    expect(input.value).toBe('45.000');
    expect(input.selectionStart).toBe(1);
  });

  it('marks the control as touched on blur and follows its disabled state', async () => {
    const { fixture, input, price } = await render();

    input.dispatchEvent(new Event('blur'));
    price.disable();
    await fixture.whenStable();

    expect(price.touched).toBe(true);
    expect(input.disabled).toBe(true);
    expect(input.getAttribute('inputmode')).toBe('numeric');
  });
});
