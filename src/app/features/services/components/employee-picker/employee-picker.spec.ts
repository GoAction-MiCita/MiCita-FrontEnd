import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ServiceEmployee } from '@features/services/models/service.model';
import { EmployeePicker } from './employee-picker';

const team: ServiceEmployee[] = [
  { id: 'e1', name: 'Ana López', photoUrl: null },
  { id: 'e2', name: 'Juan Pérez', photoUrl: null },
  { id: 'e3', name: 'María Gómez', photoUrl: 'https://img.test/maria.png' },
];

@Component({
  imports: [ReactiveFormsModule, EmployeePicker],
  template: `
    <dialog open (cancel)="cancels = cancels + 1">
      <app-employee-picker
        label="Empleados"
        [formControl]="control"
        [employees]="employees()"
        [loading]="loading()"
        [failed]="failed()"
        [rejectedIds]="rejected()"
        [error]="error()"
      />
    </dialog>
    <p id="outside">fuera</p>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Host {
  readonly control = new FormControl<readonly string[]>([], { nonNullable: true });
  readonly employees = signal<readonly ServiceEmployee[]>(team);
  readonly loading = signal(false);
  readonly failed = signal(false);
  readonly rejected = signal<readonly string[]>([]);
  readonly error = signal<string | null>(null);
  cancels = 0;
}

async function render() {
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const host = fixture.componentInstance;
  const trigger = () => element.querySelector<HTMLButtonElement>('.picker__trigger')!;
  const openList = async () => {
    trigger().click();
    await fixture.whenStable();
  };
  const option = (name: string) =>
    Array.from(element.querySelectorAll<HTMLLabelElement>('.picker__option')).find((label) =>
      label.textContent?.includes(name),
    );
  const names = () =>
    Array.from(element.querySelectorAll('.picker__name')).map((n) => n.textContent?.trim());
  const search = async (text: string) => {
    const input = element.querySelector<HTMLInputElement>('.picker__search input')!;
    input.value = text;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  };
  const set = async (update: (host: Host) => void) => {
    update(host);
    await fixture.whenStable();
  };
  return { fixture, element, host, trigger, openList, option, names, search, set };
}

describe('EmployeePicker', () => {
  it('lists the employees with photo or initials and name when opened', async () => {
    const { element, trigger, openList, names } = await render();

    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(trigger().textContent).toContain('Seleccionar empleados');
    await openList();

    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(names()).toEqual(['Ana López', 'Juan Pérez', 'María Gómez']);
    expect(element.querySelector('.picker__option img')?.getAttribute('src')).toBe(
      'https://img.test/maria.png',
    );
    expect(element.querySelector('.picker__option')?.textContent).toContain('AL');
  });

  it('selects several employees and writes their ids to the control', async () => {
    const { fixture, element, host, openList, option, trigger } = await render();
    await openList();

    option('Juan')!.querySelector('input')!.click();
    option('Ana')!.querySelector('input')!.click();
    await fixture.whenStable();

    expect(host.control.value).toEqual(['e2', 'e1']);
    expect(trigger().textContent).toContain('2 empleados seleccionados');
    const chips = Array.from(element.querySelectorAll('.picker__chip')).map((c) =>
      c.textContent?.trim(),
    );
    expect(chips).toEqual(['Juan Pérez', 'Ana López']);
  });

  it('searches by name ignoring case and accents', async () => {
    const { openList, search, names } = await render();
    await openList();

    await search('PEREZ');
    expect(names()).toEqual(['Juan Pérez']);

    await search('zzz');
    expect(names()).toEqual([]);
  });

  it('shows the associated employees checked and lets the user remove them', async () => {
    const { fixture, element, host, openList, option } = await render();
    host.control.setValue(['e1', 'e3']);
    await fixture.whenStable();
    await openList();

    expect(option('Ana')!.querySelector('input')!.checked).toBe(true);
    expect(option('Juan')!.querySelector('input')!.checked).toBe(false);

    element.querySelector<HTMLButtonElement>('button[aria-label="Quitar a Ana López"]')!.click();
    await fixture.whenStable();
    expect(host.control.value).toEqual(['e3']);

    option('María')!.querySelector('input')!.click();
    expect(host.control.value).toEqual([]);
  });

  it('marks the employees the backend rejected and shows the message', async () => {
    const { element, host, set, openList, option, trigger } = await render();
    host.control.setValue(['e2']);
    await set((h) => {
      h.rejected.set(['e2']);
      h.error.set('Algunos empleados ya no están disponibles.');
    });
    await openList();

    expect(element.querySelector('.picker__chip--rejected')?.textContent).toContain('Juan Pérez');
    expect(option('Juan')!.classList).toContain('picker__option--rejected');
    expect(option('Juan')!.textContent).toContain('No disponible');
    expect(trigger().getAttribute('aria-invalid')).toBe('true');
    expect(element.querySelector('.picker__error')?.textContent).toContain(
      'ya no están disponibles',
    );
  });

  it('explains when the business has no employees', async () => {
    const { element, set, openList, trigger } = await render();
    await set((h) => h.employees.set([]));

    expect(trigger().textContent).toContain('Sin empleados registrados');
    await openList();
    expect(element.textContent).toContain('Puedes guardar el servicio sin empleados');
  });

  it.each([
    ['loading', (h: Host) => h.loading.set(true), 'Cargando empleados'],
    ['failed', (h: Host) => h.failed.set(true), 'No pudimos cargar los empleados'],
  ] as const)('shows the %s state', async (_state, update, text) => {
    const { element, set, openList } = await render();
    await set(update);
    await openList();

    expect(element.textContent).toContain(text);
  });

  it('closes with Esc without closing the surrounding dialog', async () => {
    const { fixture, element, host, openList, trigger } = await render();
    await openList();

    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    element.querySelector('.picker__search input')!.dispatchEvent(escape);
    await fixture.whenStable();

    expect(escape.defaultPrevented).toBe(true);
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(host.cancels).toBe(0);
    expect(host.control.touched).toBe(true);
  });

  it('closes when clicking outside', async () => {
    const { fixture, element, openList, trigger } = await render();
    await openList();

    element.querySelector<HTMLElement>('#outside')!.click();
    await fixture.whenStable();

    expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('follows the disabled state of the control', async () => {
    const { fixture, host, trigger } = await render();

    host.control.disable();
    await fixture.whenStable();

    expect(trigger().disabled).toBe(true);
  });

  it('renders names as text, never as HTML', async () => {
    const { element, set, openList } = await render();
    await set((h) =>
      h.employees.set([{ id: 'x', name: '<img src=x onerror=alert(1)>', photoUrl: null }]),
    );
    await openList();

    expect(element.querySelector('.picker__option img[src="x"]')).toBeNull();
    expect(element.textContent).toContain('<img src=x onerror=alert(1)>');
  });
});
