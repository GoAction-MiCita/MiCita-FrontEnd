import { TestBed } from '@angular/core/testing';
import {
  SERVICE_FORM_MESSAGES,
  ServiceFormFailure,
} from '@features/services/models/service-form-failure';
import { NewService, Service } from '@features/services/models/service.model';
import { ServiceFormPanel } from './service-form-panel';

type FieldName = keyof NewService;

async function render() {
  const fixture = TestBed.createComponent(ServiceFormPanel);
  const submitted: NewService[] = [];
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
  const button = (text: string) =>
    Array.from(element.querySelectorAll('button')).find(
      (b) => b.textContent?.includes(text) || b.getAttribute('aria-label') === text,
    )!;

  return {
    fixture,
    element,
    control,
    fill,
    submit,
    button,
    submitted,
    closes: () => closes,
  };
}

describe('ServiceFormPanel', () => {
  it('opens as a modal with the HU-09 fields and the optional employees picker', async () => {
    const { element, control } = await render();

    expect(element.querySelector('dialog')?.hasAttribute('open')).toBe(true);
    expect(element.querySelector('h2')?.textContent).toContain('Agregar servicio');
    for (const name of ['name', 'description', 'durationMinutes', 'price', 'status'] as const) {
      expect(control(name)).toBeTruthy();
    }
    expect(control('status').value).toBe('ACTIVE');
    expect(element.querySelectorAll('.form-field__optional')).toHaveLength(3);
    expect(element.querySelector('app-multi-select')?.textContent).toContain(
      'Empleados que prestan el servicio',
    );
  });

  it('requires the name and does not submit when it is empty', async () => {
    const { element, submit, submitted } = await render();

    await submit();

    expect(submitted).toHaveLength(0);
    expect(element.textContent).toContain('El nombre del servicio es obligatorio');
  });

  it('does not submit a name made only of spaces', async () => {
    const { element, fill, submit, submitted } = await render();

    await fill({ name: '   ' });
    await submit();

    expect(submitted).toHaveLength(0);
    expect(element.textContent).toContain('El nombre del servicio es obligatorio');
  });

  it('emits the service with empty optionals as null', async () => {
    const { fill, submit, submitted } = await render();

    await fill({ name: 'Corte' });
    await submit();

    expect(submitted).toEqual([
      {
        name: 'Corte',
        description: null,
        durationMinutes: null,
        price: null,
        status: 'ACTIVE',
        employeeIds: [],
      },
    ]);
  });

  it('emits numbers for duration and price and the chosen status', async () => {
    const { fill, submit, submitted } = await render();

    await fill({
      name: 'Barba',
      description: 'Arreglo',
      durationMinutes: '30',
      price: '20000',
      status: 'INACTIVE',
    });
    await submit();

    expect(submitted).toEqual([
      {
        name: 'Barba',
        description: 'Arreglo',
        durationMinutes: 30,
        price: 20000,
        status: 'INACTIVE',
        employeeIds: [],
      },
    ]);
  });

  it.each([
    [{ durationMinutes: '0' }, 'La duración debe ser mayor a 0 minutos'],
    [{ durationMinutes: '12.5' }, 'Ingresa la duración en minutos enteros'],
  ])('rejects %o', async (values, message) => {
    const { element, fill, submit, submitted } = await render();

    await fill({ name: 'Corte', ...values });
    await submit();

    expect(submitted).toHaveLength(0);
    expect(element.textContent).toContain(message);
  });

  it('shows the price with thousands separators and emits the number', async () => {
    const { fill, control, submit, submitted } = await render();

    await fill({ name: 'Tinte', price: '85000' });
    expect(control('price').value).toBe('85.000');
    await submit();

    expect(submitted[0]?.price).toBe(85000);
  });

  it('cannot type a negative or fractional price', async () => {
    const { fill, control } = await render();

    await fill({ price: '-1500,50' });

    expect(control('price').value).toBe('150.050');
  });

  it('accepts a price of 0', async () => {
    const { fill, submit, submitted } = await render();

    await fill({ name: 'Valoración', price: '0' });
    await submit();

    expect(submitted[0]?.price).toBe(0);
  });

  it('counts the description characters up to 120', async () => {
    const { element, fill, control } = await render();

    expect(element.textContent).toContain('0/120');
    await fill({ description: 'Corte clásico' });

    expect(element.textContent).toContain('13/120');
    expect(control('description').getAttribute('maxlength')).toBe('120');
  });

  it('rejects a description longer than 120 characters', async () => {
    const { element, fill, submit, submitted } = await render();

    await fill({ name: 'Corte', description: 'a'.repeat(121) });
    await submit();

    expect(submitted).toHaveLength(0);
    expect(element.textContent).toContain('Debe tener máximo 120 caracteres');
  });

  it('shows server errors on the fields', async () => {
    const { fixture, element } = await render();
    const failure: ServiceFormFailure = {
      title: 'No pudimos crear el servicio',
      summary: 'Ya tienes un servicio con ese nombre.',
      fieldErrors: { name: 'Ya existe un servicio con ese nombre' },
    };

    fixture.componentRef.setInput('failure', failure);
    await fixture.whenStable();

    expect(element.textContent).toContain('No pudimos crear el servicio');
    expect(element.textContent).toContain('Ya existe un servicio con ese nombre');
    expect(element.querySelector('[formcontrolname="name"]')?.getAttribute('aria-invalid')).toBe(
      'true',
    );
  });

  it('does not ask to check marked fields when the 400 matches none of them', async () => {
    const { fixture, element } = await render();
    const failure: ServiceFormFailure = {
      title: 'No pudimos crear el servicio',
      summary: SERVICE_FORM_MESSAGES.checkFields,
      fieldErrors: { businessId: 'inválido' },
    };

    fixture.componentRef.setInput('failure', failure);
    await fixture.whenStable();

    const alert = element.querySelector('app-alert')?.textContent ?? '';
    expect(alert).toContain(SERVICE_FORM_MESSAGES.unexpected);
    expect(alert).not.toContain(SERVICE_FORM_MESSAGES.checkFields);
  });

  it('renders typed text as text, never as HTML', async () => {
    const { fixture, element } = await render();

    fixture.componentRef.setInput('failure', {
      title: 'x',
      summary: '<img src=x onerror=alert(1)>',
      fieldErrors: { name: '<script>alert(1)</script>' },
    } satisfies ServiceFormFailure);
    await fixture.whenStable();

    expect(element.querySelector('dialog img, dialog script')).toBeNull();
    expect(element.textContent).toContain('<script>alert(1)</script>');
  });

  it.each(['Cancelar', 'Cerrar'])('closes with "%s"', async (label) => {
    const { fixture, button, closes } = await render();

    button(label).click();
    await fixture.whenStable();

    expect(closes()).toBe(1);
  });

  it('disables saving and closing while pending', async () => {
    const { fixture, element, button } = await render();

    fixture.componentRef.setInput('pending', true);
    await fixture.whenStable();

    const save = element.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(save.disabled).toBe(true);
    expect(save.textContent).toContain('Guardando');
    expect(button('Cancelar').disabled).toBe(true);
    expect(button('Cerrar').disabled).toBe(true);

    const cancel = new Event('cancel', { cancelable: true });
    element.querySelector('dialog')!.dispatchEvent(cancel);
    expect(cancel.defaultPrevented).toBe(true);
  });

  it('lets Esc close it when idle', async () => {
    const { element } = await render();
    const cancel = new Event('cancel', { cancelable: true });

    element.querySelector('dialog')!.dispatchEvent(cancel);

    expect(cancel.defaultPrevented).toBe(false);
  });
});

describe('ServiceFormPanel in edit mode (HU-10)', () => {
  const service: Service = {
    id: 's1',
    name: 'Barba',
    description: 'Arreglo de barba',
    durationMinutes: 20,
    price: 20000,
    status: 'INACTIVE',
    employees: [
      { id: 'e1', name: 'Juan Pérez', photoUrl: null },
      { id: 'e2', name: 'Pedro Ruiz', photoUrl: null },
    ],
  };

  async function renderEdit(inputs: { service?: Service | null; loading?: boolean } = {}) {
    const rendered = await render();
    rendered.fixture.componentRef.setInput('mode', 'edit');
    rendered.fixture.componentRef.setInput('service', inputs.service ?? null);
    rendered.fixture.componentRef.setInput('loading', inputs.loading ?? false);
    await rendered.fixture.whenStable();
    return rendered;
  }

  it('shows a loading state without fields and cannot save while the service loads', async () => {
    const { element, submit, submitted } = await renderEdit({ loading: true });

    expect(element.querySelector('h2')?.textContent).toContain('Editar servicio');
    expect(element.querySelector('[role="status"]')?.textContent).toContain('Cargando servicio');
    expect(element.querySelector('[formcontrolname]')).toBeNull();
    expect(element.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);

    await submit();
    expect(submitted).toHaveLength(0);
  });

  it('prefills the form with the current data and its employees selected (HU-12)', async () => {
    const { element, control } = await renderEdit({ service });

    expect(control('name').value).toBe('Barba');
    expect(control('description').value).toBe('Arreglo de barba');
    expect(control('durationMinutes').value).toBe('20');
    expect(control('price').value).toBe('20.000');
    expect(control('status').value).toBe('INACTIVE');
    expect(element.textContent).toContain('16/120');
    const chips = Array.from(element.querySelectorAll('.multi-select__chip')).map((chip) =>
      chip.textContent?.trim(),
    );
    expect(chips).toEqual(['Juan Pérez', 'Pedro Ruiz']);
    expect(element.textContent).toContain('2 empleados seleccionados');
  });

  it('says when the business has no employees', async () => {
    const { element } = await renderEdit({ service: { ...service, employees: [] } });

    expect(element.textContent).toContain('Sin empleados registrados');
  });

  it('emits the edited values', async () => {
    const { fill, submit, submitted } = await renderEdit({ service });

    await fill({ name: 'Barba clásica', description: '', price: '25000', status: 'ACTIVE' });
    await submit();

    expect(submitted).toEqual([
      {
        name: 'Barba clásica',
        description: null,
        durationMinutes: 20,
        price: 25000,
        status: 'ACTIVE',
        employeeIds: ['e1', 'e2'],
      },
    ]);
  });

  it('validates like the create form', async () => {
    const { element, fill, submit, submitted } = await renderEdit({ service });

    await fill({ name: '', durationMinutes: '0' });
    await submit();

    expect(submitted).toHaveLength(0);
    expect(element.textContent).toContain('El nombre del servicio es obligatorio');
    expect(element.textContent).toContain('La duración debe ser mayor a 0 minutos');
  });

  it('shows a load failure without the form', async () => {
    const { fixture, element } = await renderEdit();

    fixture.componentRef.setInput('failure', {
      title: 'No pudimos cargar el servicio',
      summary: 'Sin conexión',
      fieldErrors: {},
    } satisfies ServiceFormFailure);
    await fixture.whenStable();

    expect(element.textContent).toContain('No pudimos cargar el servicio');
    expect(element.querySelector('[formcontrolname]')).toBeNull();
    expect(element.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
  });

  it('closes without emitting anything when cancelled', async () => {
    const { fixture, button, submitted, closes } = await renderEdit({ service });

    button('Cancelar').click();
    await fixture.whenStable();

    expect(closes()).toBe(1);
    expect(submitted).toHaveLength(0);
  });

  it('renders the service data as text, never as HTML', async () => {
    const { element } = await renderEdit({
      service: {
        ...service,
        employees: [{ id: 'e9', name: '<img src=x onerror=alert(1)>', photoUrl: null }],
      },
    });

    expect(element.querySelector('dialog img')).toBeNull();
    expect(element.textContent).toContain('<img src=x onerror=alert(1)>');
  });
});
