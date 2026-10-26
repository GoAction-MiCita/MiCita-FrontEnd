import { TestBed } from '@angular/core/testing';
import { EmployeeFormFailure } from '@features/employees/models/employee-form-failure';
import { NewEmployee, ServiceOption } from '@features/employees/models/employee.model';
import { EmployeeFormPanel } from './employee-form-panel';

type FieldName = keyof NewEmployee;

const services: ServiceOption[] = [
  { id: 's1', name: 'Corte', active: true },
  { id: 's2', name: 'Tinte', active: false },
];

async function render() {
  const fixture = TestBed.createComponent(EmployeeFormPanel);
  fixture.componentRef.setInput('services', services);
  const submitted: NewEmployee[] = [];
  let closes = 0;
  fixture.componentInstance.submitted.subscribe((value) => submitted.push(value));
  fixture.componentInstance.closed.subscribe(() => closes++);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;

  const control = (name: FieldName) =>
    element.querySelector<HTMLInputElement>(`[formcontrolname="${name}"]`)!;
  const fill = async (values: Partial<Record<FieldName, string>>) => {
    for (const [name, value] of Object.entries(values)) {
      const input = control(name as FieldName);
      input.value = value;
      input.dispatchEvent(new Event(input.tagName === 'SELECT' ? 'change' : 'input'));
    }
    await fixture.whenStable();
  };
  const submit = async () => {
    element.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await fixture.whenStable();
  };
  const errorOf = (name: FieldName) =>
    control(name).closest('app-form-field')?.querySelector('.form-field__message--error')
      ?.textContent ?? '';
  const set = async (name: 'pending' | 'failure', value: unknown) => {
    fixture.componentRef.setInput(name, value);
    await fixture.whenStable();
  };

  return {
    fixture,
    element,
    control,
    fill,
    submit,
    errorOf,
    set,
    submitted,
    closes: () => closes,
  };
}

describe('EmployeeFormPanel', () => {
  it('opens as a modal with the fields of the story and Activo preselected', async () => {
    const { element, control } = await render();

    expect(element.querySelector('dialog')?.open).toBe(true);
    expect(element.querySelector('h2')?.textContent).toContain('Agregar empleado');
    const headings = Array.from(element.querySelectorAll('h3')).map((l) => l.textContent?.trim());
    expect(headings).toEqual(['Información personal', 'Información laboral']);
    for (const name of ['firstName', 'lastName', 'phone', 'email', 'status'] as const) {
      expect(control(name)).not.toBeNull();
    }
    expect(element.querySelector('app-multi-select')?.textContent).toContain(
      'Servicios que presta',
    );
    expect(control('status').value).toBe('ACTIVE');
  });

  it('does not submit with empty names and marks them', async () => {
    const { submit, submitted, errorOf } = await render();

    await submit();

    expect(submitted).toEqual([]);
    expect(errorOf('firstName')).toContain('El nombre es obligatorio');
    expect(errorOf('lastName')).toContain('El apellido es obligatorio');
  });

  it('does not submit names longer than 100 characters', async () => {
    const { fill, submit, submitted, errorOf } = await render();

    await fill({ firstName: 'a'.repeat(101), lastName: 'López' });
    await submit();

    expect(submitted).toEqual([]);
    expect(errorOf('firstName')).toContain('máximo 100 caracteres');
  });

  it('shows the format errors of phone and email', async () => {
    const { fill, submit, submitted, errorOf } = await render();

    await fill({ firstName: 'Ana', lastName: 'López', phone: '12', email: 'ana@correo' });
    await submit();

    expect(submitted).toEqual([]);
    expect(errorOf('phone')).toContain('Ingresa un teléfono válido');
    expect(errorOf('email')).toContain('Ingresa un correo válido');
  });

  it('emits the employee with empty optionals as null and the chosen services', async () => {
    const { fixture, element, fill, submit, submitted } = await render();

    await fill({ firstName: ' Ana ', lastName: 'López', phone: '  ', status: 'INACTIVE' });
    element.querySelector<HTMLButtonElement>('.multi-select__trigger')!.click();
    await fixture.whenStable();
    element.querySelector<HTMLInputElement>('.multi-select__option input')!.click();
    await submit();

    expect(submitted).toEqual([
      {
        firstName: ' Ana ',
        lastName: 'López',
        phone: null,
        email: null,
        status: 'INACTIVE',
        serviceIds: ['s1'],
      },
    ]);
  });

  it('tags the inactive services in the picker', async () => {
    const { fixture, element } = await render();

    element.querySelector<HTMLButtonElement>('.multi-select__trigger')!.click();
    await fixture.whenStable();

    const hints = Array.from(element.querySelectorAll('.multi-select__hint')).map((h) =>
      h.textContent?.trim(),
    );
    expect(hints).toEqual(['Inactivo']);
  });

  it('disables Guardar while the request is in flight and keeps Esc from closing', async () => {
    const { element, set } = await render();

    await set('pending', true);

    const save = element.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(save.disabled).toBe(true);
    expect(save.textContent).toContain('Guardando');
    const cancel = new Event('cancel', { cancelable: true });
    element.querySelector('dialog')!.dispatchEvent(cancel);
    expect(cancel.defaultPrevented).toBe(true);
  });

  it('shows the server errors per field (400) and the summary', async () => {
    const { element, set, errorOf } = await render();
    const failure: EmployeeFormFailure = {
      title: 'No pudimos crear el empleado',
      summary: 'Revisa los campos marcados e inténtalo de nuevo.',
      fieldErrors: { lastName: 'El apellido es inválido' },
    };

    await set('failure', failure);

    expect(element.querySelector('app-alert')?.textContent).toContain('Revisa los campos');
    expect(errorOf('lastName')).toContain('El apellido es inválido');
  });

  it('marks the services the backend rejected', async () => {
    const { fixture, element, set } = await render();
    fixture.componentInstance['form'].controls.serviceIds.setValue(['s2']);
    await set('failure', {
      title: 'x',
      summary: 'y',
      fieldErrors: { serviceIds: 'Algunos servicios ya no están disponibles.' },
      rejectedServiceIds: ['s2'],
    } satisfies EmployeeFormFailure);

    expect(element.querySelector('.multi-select__chip--rejected')?.textContent).toContain('Tinte');
    expect(element.querySelector('.multi-select__error')?.textContent).toContain(
      'ya no están disponibles',
    );
  });

  it('closes with Cancelar without emitting the employee', async () => {
    const { element, submitted, closes } = await render();

    Array.from(element.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('Cancelar'))!
      .click();

    expect(closes()).toBe(1);
    expect(submitted).toEqual([]);
  });
});
