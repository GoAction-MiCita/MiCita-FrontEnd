import { TestBed } from '@angular/core/testing';
import { Employee } from '@features/employees/models/employee.model';
import { EMPTY_VALUE } from '@shared/formatting/format';
import { COMING_SOON, EmployeesTable } from './employees-table';

const ana: Employee = {
  id: 'e1',
  firstName: 'Ana',
  lastName: 'López',
  fullName: 'Ana López',
  phone: '3001234567',
  email: 'ana@correo.com',
  status: 'ACTIVE',
  services: [
    { id: 's1', name: 'Corte' },
    { id: 's2', name: 'Barba' },
    { id: 's3', name: 'Tinte' },
  ],
};
const juan: Employee = {
  ...ana,
  id: 'e2',
  firstName: 'Juan',
  lastName: 'Pérez',
  fullName: 'Juan Pérez',
  phone: null,
  email: null,
  status: 'INACTIVE',
  services: [],
};

async function render(employees: readonly Employee[]) {
  const fixture = TestBed.createComponent(EmployeesTable);
  fixture.componentRef.setInput('employees', employees);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

// Text of each cell with its pieces (avatar, hidden label, tags…) separated by one space.
const cells = (row: Element) =>
  Array.from(row.querySelectorAll('td')).map((td) =>
    Array.from(td.querySelectorAll('span:not(:has(*)), a, li'))
      .map((node) => node.textContent?.trim())
      .filter(Boolean)
      .join(' '),
  );

describe('EmployeesTable', () => {
  it('shows the columns of the story', async () => {
    const element = await render([ana]);

    const headers = Array.from(element.querySelectorAll('th')).map((th) => th.textContent?.trim());
    expect(headers).toEqual(['Nombre', 'Teléfono', 'Correo', 'Servicios', 'Estado', 'Acciones']);
  });

  it('shows one row per employee with avatar initials, contact, services and status', async () => {
    const element = await render([ana, juan]);
    const [first, second] = Array.from(element.querySelectorAll('tbody tr'));

    expect(first.querySelector('.employees-table__avatar')?.textContent?.trim()).toBe('AL');
    expect(cells(first).slice(0, 5)).toEqual([
      'AL Ana López',
      'Teléfono: 300 123 4567',
      'Correo: ana@correo.com',
      'Servicios: Corte Barba +1',
      'Activo',
    ]);
    expect(first.querySelector('a')?.getAttribute('href')).toBe('mailto:ana@correo.com');

    expect(cells(second).slice(0, 5)).toEqual([
      'JP Juan Pérez',
      `Teléfono: ${EMPTY_VALUE}`,
      `Correo: ${EMPTY_VALUE}`,
      `Servicios: ${EMPTY_VALUE}`,
      'Inactivo',
    ]);
  });

  it('names each row action and keeps activate and delete disabled until their stories exist', async () => {
    const element = await render([ana, juan]);

    const buttons = Array.from(element.querySelectorAll<HTMLButtonElement>('tbody button'));
    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Editar Ana López',
      'Desactivar Ana López',
      'Eliminar Ana López',
      'Editar Juan Pérez',
      'Activar Juan Pérez',
      'Eliminar Juan Pérez',
    ]);
    const pending = buttons.filter((button) => !button.ariaLabel?.startsWith('Editar'));
    expect(pending.every((button) => button.disabled && button.title === COMING_SOON)).toBe(true);
  });

  it('emits the employee of the row on Editar (HU-18)', async () => {
    const fixture = TestBed.createComponent(EmployeesTable);
    fixture.componentRef.setInput('employees', [ana, juan]);
    const edited: Employee[] = [];
    fixture.componentInstance.edit.subscribe((employee) => edited.push(employee));
    await fixture.whenStable();

    const edit = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      'button[aria-label="Editar Juan Pérez"]',
    )!;
    expect(edit.disabled).toBe(false);
    edit.click();

    expect(edited).toEqual([juan]);
  });
});
