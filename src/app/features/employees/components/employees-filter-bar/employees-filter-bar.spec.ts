import { TestBed } from '@angular/core/testing';
import { NO_EMPLOYEE_FILTERS, EmployeeFilters } from '@features/employees/models/employee-filters';
import { NAME_FILTER_DEBOUNCE_MS, EmployeesFilterBar } from './employees-filter-bar';

async function render(filters: EmployeeFilters = NO_EMPLOYEE_FILTERS) {
  const fixture = TestBed.createComponent(EmployeesFilterBar);
  fixture.componentRef.setInput('filters', filters);
  const changes: EmployeeFilters[] = [];
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

describe('EmployeesFilterBar', () => {
  afterEach(() => vi.useRealTimers());

  it('has labelled name and status filters inside a search landmark', async () => {
    const { element, status } = await render();

    expect(element.querySelector('form')?.getAttribute('role')).toBe('search');
    expect(element.querySelector('label')?.textContent).toContain('Buscar por nombre o apellido');
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
    expect(changes).toEqual([{ name: 'cor', status: null, serviceIds: [] }]);
  });

  it('filters by status right away and keeps the other filters', async () => {
    const { fixture, choose, changes } = await render({
      name: 'cor',
      status: null,
      serviceIds: ['e1'],
    });

    choose('INACTIVE');
    // The page writes it to the URL, which comes back as the new `filters`.
    fixture.componentRef.setInput('filters', changes[0]);
    await fixture.whenStable();
    choose('');

    expect(changes).toEqual([
      { name: 'cor', status: 'INACTIVE', serviceIds: ['e1'] },
      { name: 'cor', status: null, serviceIds: ['e1'] },
    ]);
  });

  it('does not emit when the name does not really change', async () => {
    const { type, changes } = await render({ ...NO_EMPLOYEE_FILTERS, name: 'cor' });
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
      serviceIds: ['e1'],
    });
    vi.useFakeTimers();

    type('cortes'); // typed just before clearing: must not come back
    clearButton()!.click();
    vi.advanceTimersByTime(NAME_FILTER_DEBOUNCE_MS);

    expect(changes).toEqual([NO_EMPLOYEE_FILTERS]);
  });

  it('follows filters set from outside (URL, back button)', async () => {
    const { fixture, name, status, changes } = await render();

    fixture.componentRef.setInput('filters', { name: 'bar', status: 'INACTIVE', serviceIds: [] });
    await fixture.whenStable();

    expect(name.value).toBe('bar');
    expect(status.value).toBe('INACTIVE');
    expect(changes).toHaveLength(0);
  });
});

describe('EmployeesFilterBar services filter', () => {
  it('filters by the services chosen in the picker right away, tagging the inactive ones', async () => {
    const { fixture, element, changes } = await render({ ...NO_EMPLOYEE_FILTERS, name: 'ana' });
    fixture.componentRef.setInput('services', [
      { id: 's1', name: 'Corte', active: true },
      { id: 's2', name: 'Tinte', active: false },
    ]);
    await fixture.whenStable();

    element.querySelector<HTMLButtonElement>('.multi-select__trigger')!.click();
    await fixture.whenStable();
    const hints = Array.from(element.querySelectorAll('.multi-select__hint')).map((h) =>
      h.textContent?.trim(),
    );
    element.querySelector<HTMLInputElement>('.multi-select__option input')!.click();

    expect(hints).toEqual(['Inactivo']);
    expect(changes).toEqual([{ name: 'ana', status: null, serviceIds: ['s1'] }]);
    expect(element.querySelector('.multi-select__label')?.classList).toContain('u-visually-hidden');
  });

  it('shows the services from the URL as selected', async () => {
    const { fixture, element } = await render({ ...NO_EMPLOYEE_FILTERS, serviceIds: ['s1', 's2'] });
    await fixture.whenStable();

    expect(element.querySelector('.multi-select__trigger')?.textContent).toContain(
      '2 servicios seleccionados',
    );
  });

  it('renders service names as text, never as HTML', async () => {
    const { fixture, element } = await render();
    fixture.componentRef.setInput('services', [
      { id: 's1', name: '<img src=x onerror=alert(1)>', active: true },
    ]);
    await fixture.whenStable();
    element.querySelector<HTMLButtonElement>('.multi-select__trigger')!.click();
    await fixture.whenStable();

    expect(element.querySelector('.multi-select img')).toBeNull();
    expect(element.textContent).toContain('<img src=x onerror=alert(1)>');
  });
});
