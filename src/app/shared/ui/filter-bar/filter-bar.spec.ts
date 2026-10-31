import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FilterBar, NAME_FILTER_DEBOUNCE_MS } from './filter-bar';

@Component({
  imports: [FilterBar],
  template: `
    <app-filter-bar
      label="Filtrar cosas"
      searchLabel="Buscar cosas"
      [name]="name()"
      [canClear]="canClear()"
      (nameChange)="names.push($event)"
      (cleared)="clears = clears + 1"
    >
      <select aria-label="Estado">
        <option>Todos</option>
      </select>
    </app-filter-bar>
  `,
})
class Host {
  readonly name = signal('');
  readonly canClear = signal(false);
  readonly names: string[] = [];
  clears = 0;
}

async function render() {
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const input = element.querySelector<HTMLInputElement>('input[type="search"]')!;
  const type = (value: string) => {
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };
  const clearButton = () =>
    Array.from(element.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Limpiar filtros'),
    );
  return { fixture, host: fixture.componentInstance, element, input, type, clearButton };
}

describe('FilterBar', () => {
  afterEach(() => vi.useRealTimers());

  it('renders a labelled search landmark with the projected filters', async () => {
    const { element, input } = await render();

    const form = element.querySelector('form')!;
    expect(form.getAttribute('role')).toBe('search');
    expect(form.getAttribute('aria-label')).toBe('Filtrar cosas');
    expect(element.querySelector('label')?.textContent).toContain('Buscar cosas');
    expect(input.placeholder).toBe('Buscar cosas');
    expect(input.maxLength).toBe(100);
    expect(form.querySelector('select[aria-label="Estado"]')).not.toBeNull();
  });

  it('emits the trimmed name 300 ms after the last keystroke', async () => {
    const { host, type } = await render();
    vi.useFakeTimers();

    type('c');
    vi.advanceTimersByTime(200);
    type(' cor ');
    vi.advanceTimersByTime(NAME_FILTER_DEBOUNCE_MS - 1);
    expect(host.names).toEqual([]);

    vi.advanceTimersByTime(1);
    expect(host.names).toEqual(['cor']);
  });

  it('shows "Limpiar filtros" only when told, and cancels a pending name', async () => {
    const { fixture, host, input, type, clearButton } = await render();
    expect(clearButton()).toBeUndefined();

    host.canClear.set(true);
    await fixture.whenStable();
    vi.useFakeTimers();

    type('cortes'); // typed just before clearing: must not come back
    clearButton()!.click();
    vi.advanceTimersByTime(NAME_FILTER_DEBOUNCE_MS);

    expect(host.clears).toBe(1);
    expect(host.names).toEqual([]);
    expect(input.value).toBe('');
  });

  it('follows the name set from outside without emitting', async () => {
    const { fixture, host, input } = await render();
    vi.useFakeTimers();

    host.name.set('bar');
    fixture.detectChanges();
    vi.advanceTimersByTime(NAME_FILTER_DEBOUNCE_MS);

    expect(input.value).toBe('bar');
    expect(host.names).toEqual([]);
  });
});
