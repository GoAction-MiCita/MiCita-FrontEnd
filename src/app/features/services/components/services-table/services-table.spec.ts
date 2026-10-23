import { TestBed } from '@angular/core/testing';
import { Service } from '@features/services/models/service.model';
import { ServicesTable } from './services-table';

const haircut: Service = {
  id: 's1',
  name: 'Corte de cabello',
  description: 'Corte profesional',
  durationMinutes: 90,
  price: 45000,
  status: 'ACTIVE',
  employees: [
    { id: 'e1', name: 'Ana López', photoUrl: null },
    { id: 'e2', name: 'Juan Pérez', photoUrl: null },
    { id: 'e3', name: 'María Gómez', photoUrl: null },
    { id: 'e4', name: 'Pedro Ruiz', photoUrl: null },
  ],
};

const facial: Service = {
  id: 's2',
  name: 'Limpieza facial',
  description: null,
  durationMinutes: null,
  price: null,
  status: 'INACTIVE',
  employees: [],
};

async function render(services: Service[]) {
  const fixture = TestBed.createComponent(ServicesTable);
  fixture.componentRef.setInput('services', services);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  return { element, rows: Array.from(element.querySelectorAll('tbody tr')) };
}

describe('ServicesTable', () => {
  it('shows the columns required by HU-08', async () => {
    const { element } = await render([haircut]);

    const headers = Array.from(element.querySelectorAll('th')).map((th) => th.textContent?.trim());
    expect(headers).toEqual(['Servicio', 'Duración', 'Precio', 'Empleados', 'Estado', 'Acciones']);
  });

  it('formats duration, price, employees and status', async () => {
    const { rows } = await render([haircut]);
    const text = rows[0].textContent ?? '';

    expect(text).toContain('Corte de cabello');
    expect(text).toContain('Corte profesional');
    expect(text).toContain('1 h 30 min');
    expect(text).toContain('$ 45.000');
    expect(text).toContain('AL');
    expect(text).toContain('+1');
    expect(text).toContain('Activo');
  });

  it('shows dashes for empty values and an inactive badge', async () => {
    const { rows } = await render([facial]);
    const cells = Array.from(rows[0].querySelectorAll('td')).map((td) => td.textContent?.trim());

    expect(cells[1]).toBe('—');
    expect(cells[2]).toBe('—');
    expect(cells[3]).toBe('—');
    expect(cells[4]).toBe('Inactivo');
  });

  it('renders the row actions disabled with accessible names', async () => {
    const { rows } = await render([haircut, facial]);
    const buttons = Array.from(rows[0].querySelectorAll('button'));

    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Editar Corte de cabello',
      'Desactivar Corte de cabello',
      'Eliminar Corte de cabello',
    ]);
    expect(buttons.every((b) => b.disabled)).toBe(true);
    expect(rows[1].querySelectorAll('button')[1].getAttribute('aria-label')).toBe(
      'Activar Limpieza facial',
    );
  });

  it('renders malicious names and descriptions as plain text', async () => {
    const { element } = await render([
      {
        ...facial,
        name: '<img src=x onerror=alert(1)>',
        description: '<script>alert(1)</script>',
      },
    ]);

    expect(element.querySelector('img')).toBeNull();
    expect(element.querySelector('script')).toBeNull();
    expect(element.textContent).toContain('<script>alert(1)</script>');
  });
});
