import { TestBed } from '@angular/core/testing';
import {
  EMPLOYEE_FORM_MESSAGES,
  EmployeeFormFailure,
} from '@features/employees/models/employee-form-failure';
import { Employee, NewEmployee, ServiceOption } from '@features/employees/models/employee.model';
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
  const set = async (name: 'pending' | 'loading' | 'failure', value: unknown) => {
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

  it('does not submit names made only of spaces', async () => {
    const { fill, submit, submitted, errorOf } = await render();

    await fill({ firstName: '   ', lastName: '\t ' });
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

  it('does not ask to check marked fields when the 400 matches none of them', async () => {
    const { element, set } = await render();

    await set('failure', {
      title: EMPLOYEE_FORM_MESSAGES.title,
      summary: EMPLOYEE_FORM_MESSAGES.checkFields,
      fieldErrors: { businessId: 'inválido' },
    } satisfies EmployeeFormFailure);

    const alert = element.querySelector('app-alert')?.textContent ?? '';
    expect(alert).toContain(EMPLOYEE_FORM_MESSAGES.unexpected);
    expect(alert).not.toContain(EMPLOYEE_FORM_MESSAGES.checkFields);
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

  it('shows a <script> typed in a name as text, never as markup', async () => {
    const { fixture, element, fill, submit, submitted } = await render();

    await fill({
      firstName: '<script>alert(1)</script>',
      lastName: '"><img src=x onerror=alert(1)>',
    });
    await submit();
    await fixture.whenStable();

    expect(submitted[0]?.firstName).toBe('<script>alert(1)</script>');
    expect(element.querySelector('script, img')).toBeNull();
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

describe('EmployeeFormPanel · editar (HU-18)', () => {
  const ana: Employee = {
    id: 'e1',
    firstName: 'Ana',
    lastName: 'López',
    fullName: 'Ana López',
    phone: '3001234567',
    email: null,
    status: 'INACTIVE',
    // s9 is not in the business list (e.g. beyond the first 100 services).
    services: [
      { id: 's2', name: 'Tinte' },
      { id: 's9', name: 'Masaje' },
    ],
  };

  async function renderEdit() {
    const page = await render();
    page.fixture.componentRef.setInput('mode', 'edit');
    await page.fixture.whenStable();
    return page;
  }

  it('shows "Cargando empleado…" and cannot be saved while the employee loads', async () => {
    const { element, set, submit, submitted } = await renderEdit();

    await set('loading', true);
    await submit();

    expect(element.querySelector('h2')?.textContent).toContain('Editar empleado');
    expect(element.querySelector('[role="status"]')?.textContent).toContain('Cargando empleado');
    expect(element.querySelector('[formcontrolname="firstName"]')).toBeNull();
    expect(element.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);
    expect(submitted).toEqual([]);
  });

  it('fills the form with the employee and its services, and saves the changes', async () => {
    const { fixture, element, control, fill, submit, submitted } = await renderEdit();
    fixture.componentRef.setInput('employee', ana);
    await fixture.whenStable();

    expect(control('firstName').value).toBe('Ana');
    expect(control('phone').value).toBe('3001234567');
    expect(control('email').value).toBe('');
    expect(control('status').value).toBe('INACTIVE');
    const chips = Array.from(element.querySelectorAll('.multi-select__chip')).map((chip) =>
      chip.textContent?.trim(),
    );
    expect(chips).toEqual([expect.stringContaining('Tinte'), expect.stringContaining('Masaje')]);
    expect(element.querySelector('button[type="submit"]')?.textContent).toContain(
      'Guardar cambios',
    );

    await fill({ lastName: 'Gómez', status: 'ACTIVE' });
    await submit();

    expect(submitted).toEqual([
      {
        firstName: 'Ana',
        lastName: 'Gómez',
        phone: '3001234567',
        email: null,
        status: 'ACTIVE',
        serviceIds: ['s2', 's9'],
      },
    ]);
  });

  it('sends the services left after removing one', async () => {
    const { fixture, element, submit, submitted } = await renderEdit();
    fixture.componentRef.setInput('employee', ana);
    await fixture.whenStable();

    element.querySelector<HTMLButtonElement>('button[aria-label="Quitar Tinte"]')!.click();
    await fixture.whenStable();
    await submit();

    expect(submitted[0]?.serviceIds).toEqual(['s9']);
  });

  it('keeps the edits and shows the 409 on the duplicated field', async () => {
    const { fixture, set, fill, control, errorOf } = await renderEdit();
    fixture.componentRef.setInput('employee', ana);
    await fixture.whenStable();
    await fill({ phone: '3009998877' });

    await set('failure', {
      title: EMPLOYEE_FORM_MESSAGES.updateTitle,
      summary: EMPLOYEE_FORM_MESSAGES.duplicate,
      fieldErrors: { phone: EMPLOYEE_FORM_MESSAGES.duplicatePhone },
    } satisfies EmployeeFormFailure);

    expect(control('phone').value).toBe('3009998877');
    expect(errorOf('phone')).toContain(EMPLOYEE_FORM_MESSAGES.duplicatePhone);
  });
});
