import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormField } from './form-field';
import { FormFieldControl } from './form-field-control';

@Component({
  imports: [ReactiveFormsModule, FormField, FormFieldControl],
  template: `
    <form [formGroup]="form">
      <app-form-field label="Nombre" hint="Tu nombre" [errorMessages]="{ required: 'Falta' }">
        <input appFormFieldControl formControlName="name" />
      </app-form-field>
    </form>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Host {
  readonly form = new FormGroup({ name: new FormControl('', Validators.required) });
}

async function render() {
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    element,
    input: element.querySelector('input') as HTMLInputElement,
    label: element.querySelector('label') as HTMLLabelElement,
  };
}

describe('FormField', () => {
  it('links the label and hint to the control and marks it required', async () => {
    const { input, label, element } = await render();

    expect(label.htmlFor).toBe(input.id);
    expect(label.textContent).toContain('*');
    expect(input.getAttribute('aria-describedby')).toBe(element.querySelector('p')?.id);
    expect(input.getAttribute('aria-invalid')).toBe('false');
  });

  it('shows the error only after the control is touched', async () => {
    const { fixture, input, element } = await render();
    expect(element.textContent).not.toContain('Falta');

    fixture.componentInstance.form.markAllAsTouched();
    await fixture.whenStable();

    expect(element.textContent).toContain('Falta');
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('shows server errors set on the control', async () => {
    const { fixture, element } = await render();
    const control = fixture.componentInstance.form.controls.name;

    control.setValue('Ana');
    control.setErrors({ server: 'Nombre no permitido' });
    control.markAsTouched();
    await fixture.whenStable();

    expect(element.textContent).toContain('Nombre no permitido');
  });
});
