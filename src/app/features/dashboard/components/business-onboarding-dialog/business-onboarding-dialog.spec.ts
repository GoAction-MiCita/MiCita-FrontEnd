import { TestBed } from '@angular/core/testing';
import { NewBusiness } from '@features/dashboard/models/business.model';
import { OnboardingFailure } from '@features/dashboard/models/onboarding-failure';
import { BusinessOnboardingDialog } from './business-onboarding-dialog';

async function render() {
  const fixture = TestBed.createComponent(BusinessOnboardingDialog);
  const submitted: NewBusiness[] = [];
  let logouts = 0;
  fixture.componentInstance.submitted.subscribe((value) => submitted.push(value));
  fixture.componentInstance.logoutRequested.subscribe(() => logouts++);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;

  const fill = async (values: Partial<Record<keyof NewBusiness, string>>) => {
    for (const [name, value] of Object.entries(values)) {
      const input = element.querySelector<HTMLInputElement>(`[formcontrolname="${name}"]`)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    }
    await fixture.whenStable();
  };
  const submit = async () => {
    element.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await fixture.whenStable();
  };

  return { fixture, element, fill, submit, submitted, logouts: () => logouts };
}

describe('BusinessOnboardingDialog', () => {
  it('opens as a modal dialog with every field and optional markers', async () => {
    const { element } = await render();

    expect(element.querySelector('dialog')?.hasAttribute('open')).toBe(true);
    for (const name of ['name', 'address', 'phone', 'nit', 'email']) {
      expect(element.querySelector(`[formcontrolname="${name}"]`)).toBeTruthy();
    }
    expect(element.querySelectorAll('.form-field__optional')).toHaveLength(2);
    expect(element.textContent).not.toContain('Cerrar modal');
  });

  it('cannot be dismissed with Esc', async () => {
    const { element } = await render();
    const cancel = new Event('cancel', { cancelable: true });

    element.querySelector('dialog')!.dispatchEvent(cancel);

    expect(cancel.defaultPrevented).toBe(true);
  });

  it('opens again if the browser closes it anyway', async () => {
    const { fixture, element } = await render();
    const dialog = element.querySelector('dialog')!;

    dialog.removeAttribute('open');
    dialog.dispatchEvent(new Event('close'));
    await fixture.whenStable();

    expect(dialog.hasAttribute('open')).toBe(true);
  });

  it('shows required errors and does not submit when fields are empty', async () => {
    const { element, submit, submitted } = await render();

    await submit();

    expect(submitted).toHaveLength(0);
    expect(element.textContent).toContain('El nombre del negocio es obligatorio');
    expect(element.textContent).toContain('La dirección es obligatoria');
    expect(element.textContent).toContain('El teléfono es obligatorio');
  });

  it('validates the optional NIT and email only when filled', async () => {
    const { element, fill, submit, submitted } = await render();

    await fill({ name: 'X', address: 'Y', phone: '300 12', nit: '12', email: 'a@b' });
    await submit();

    expect(submitted).toHaveLength(0);
    expect(element.textContent).toContain('Ingresa un teléfono válido');
    expect(element.textContent).toContain('Ingresa un NIT válido');
    expect(element.textContent).toContain('Ingresa un correo válido');
  });

  it('emits the business when the form is valid', async () => {
    const { fill, submit, submitted } = await render();

    await fill({ name: 'Barbería El Estilo', address: 'Cra 25', phone: '300 123 4567' });
    await submit();

    expect(submitted).toEqual([
      { name: 'Barbería El Estilo', address: 'Cra 25', phone: '300 123 4567', nit: '', email: '' },
    ]);
  });

  it('shows the failure and attaches server errors to the fields', async () => {
    const { fixture, element } = await render();
    const failure: OnboardingFailure = {
      title: 'Este negocio ya está registrado',
      summary: 'Ya existe un negocio con el mismo NIT. Verifica los datos.',
      fieldErrors: { nit: 'Este NIT ya está registrado' },
    };

    fixture.componentRef.setInput('failure', failure);
    await fixture.whenStable();

    expect(element.querySelector('app-alert')?.textContent).toContain('mismo NIT');
    expect(element.textContent).toContain('Este NIT ya está registrado');
  });

  it('disables the submit button while pending', async () => {
    const { fixture, element } = await render();

    fixture.componentRef.setInput('pending', true);
    await fixture.whenStable();

    const button = element.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain('Registrando negocio');
  });

  it('lets the user log out instead', async () => {
    const { element, logouts } = await render();

    element.querySelector<HTMLButtonElement>('.onboarding-dialog__link')!.click();

    expect(logouts()).toBe(1);
  });
});
