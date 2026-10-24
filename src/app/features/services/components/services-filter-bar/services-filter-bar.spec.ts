import { TestBed } from '@angular/core/testing';
import { NO_SERVICE_FILTERS, ServiceFilters } from '@features/services/models/service-filters';
import { NAME_FILTER_DEBOUNCE_MS, ServicesFilterBar } from './services-filter-bar';

async function render(filters: ServiceFilters = NO_SERVICE_FILTERS) {
  const fixture = TestBed.createComponent(ServicesFilterBar);
  fixture.componentRef.setInput('filters', filters);
  const changes: ServiceFilters[] = [];
  fixture.componentInstance.filtersChange.subscribe((value) => changes.push(value));
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const name = element.querySelector<HTMLInputElement>('input[type="search"]')!;
  const status = element.querySelector<HTMLSelectElement>('select')!;
  const type = (value: string) => {
    name.value = value;
    name.dispatchEvent(new Event('input'));
  };
  const choose = (value: string) => {
    status.value = value;
    status.dispatchEvent(new Event('change'));
  };
  const clearButton = () =>
    Array.from(element.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Limpiar filtros'),
    );
  return { fixture, element, name, status, type, choose, clearButton, changes };
}

describe('ServicesFilterBar', () => {
  afterEach(() => vi.useRealTimers());

  it('has labelled name and status filters inside a search landmark', async () => {
    const { element, status } = await render();

    expect(element.querySelector('form')?.getAttribute('role')).toBe('search');
    expect(element.querySelector('label')?.textContent).toContain('Buscar por nombre');
    expect(Array.from(status.options).map((o) => o.textContent?.trim())).toEqual([
      'Todos',
      'Activo',
      'Inactivo',
    ]);
  });

  it('waits 300 ms after the last keystroke before filtering by name', async () => {
    const { type, changes } = await render();
    vi.useFakeTimers();

    type('c');
    vi.advanceTimersByTime(200);
    type('cor ');
    vi.advanceTimersByTime(NAME_FILTER_DEBOUNCE_MS - 1);
    expect(changes).toHaveLength(0);

    vi.advanceTimersByTime(1);
    expect(changes).toEqual([{ name: 'cor', status: null, employeeIds: [] }]);
  });

  it('filters by status right away and keeps the other filters', async () => {
    const { fixture, choose, changes } = await render({
      name: 'cor',
      status: null,
      employeeIds: ['e1'],
    });

    choose('INACTIVE');
    // The page writes it to the URL, which comes back as the new `filters`.
    fixture.componentRef.setInput('filters', changes[0]);
    await fixture.whenStable();
    choose('');

    expect(changes).toEqual([
      { name: 'cor', status: 'INACTIVE', employeeIds: ['e1'] },
      { name: 'cor', status: null, employeeIds: ['e1'] },
    ]);
  });

  it('does not emit when the name does not really change', async () => {
    const { type, changes } = await render({ ...NO_SERVICE_FILTERS, name: 'cor' });
    vi.useFakeTimers();

    type(' cor ');
    vi.advanceTimersByTime(NAME_FILTER_DEBOUNCE_MS);

    expect(changes).toHaveLength(0);
  });

  it('shows "Limpiar filtros" only with filters, and clears all of them', async () => {
    const empty = await render();
    expect(empty.clearButton()).toBeUndefined();
    TestBed.resetTestingModule();

    const { clearButton, changes, type } = await render({
      name: 'cor',
      status: 'ACTIVE',
      employeeIds: ['e1'],
    });
    vi.useFakeTimers();

    type('cortes'); // typed just before clearing: must not come back
    clearButton()!.click();
    vi.advanceTimersByTime(NAME_FILTER_DEBOUNCE_MS);

    expect(changes).toEqual([NO_SERVICE_FILTERS]);
  });

  it('follows filters set from outside (URL, back button)', async () => {
    const { fixture, name, status, changes } = await render();

    fixture.componentRef.setInput('filters', { name: 'bar', status: 'INACTIVE', employeeIds: [] });
    await fixture.whenStable();

    expect(name.value).toBe('bar');
    expect(status.value).toBe('INACTIVE');
    expect(changes).toHaveLength(0);
  });
});

describe('ServicesFilterBar employees filter (HU-12)', () => {
  it('filters by the employees chosen in the picker right away', async () => {
    const { fixture, element, changes } = await render({ ...NO_SERVICE_FILTERS, name: 'cor' });
    fixture.componentRef.setInput('employees', [
      { id: 'e1', name: 'Ana López', photoUrl: null },
      { id: 'e2', name: 'Juan Pérez', photoUrl: null },
    ]);
    await fixture.whenStable();

    element.querySelector<HTMLButtonElement>('.picker__trigger')!.click();
    await fixture.whenStable();
    element.querySelector<HTMLInputElement>('.picker__option input')!.click();

    expect(changes).toEqual([{ name: 'cor', status: null, employeeIds: ['e1'] }]);
    expect(element.querySelector('.picker__label')?.classList).toContain('u-visually-hidden');
  });

  it('shows the employees from the URL as selected', async () => {
    const { fixture, element } = await render({ ...NO_SERVICE_FILTERS, employeeIds: ['e1', 'e2'] });
    await fixture.whenStable();

    expect(element.querySelector('.picker__trigger')?.textContent).toContain(
      '2 empleados seleccionados',
    );
  });
});
