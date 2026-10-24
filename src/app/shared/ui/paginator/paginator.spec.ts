import { TestBed } from '@angular/core/testing';
import { Paginator } from './paginator';
import { PageSize } from './paging';

interface State {
  page: number;
  size: PageSize;
  totalElements: number;
  totalPages: number;
}

async function render(state: State) {
  const fixture = TestBed.createComponent(Paginator);
  const set = async (next: Partial<State>) => {
    Object.entries({ ...state, ...next }).forEach(([key, value]) =>
      fixture.componentRef.setInput(key, value),
    );
    await fixture.whenStable();
  };
  fixture.componentRef.setInput('itemsLabel', 'servicios');
  await set({});
  const pages: number[] = [];
  const sizes: PageSize[] = [];
  fixture.componentInstance.pageChange.subscribe((page) => pages.push(page));
  fixture.componentInstance.sizeChange.subscribe((size) => sizes.push(size));
  const element = fixture.nativeElement as HTMLElement;
  const button = (label: string) =>
    element.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
  const numbers = () =>
    Array.from(element.querySelectorAll('.paginator__pages li')).map((li) =>
      li.textContent?.trim(),
    );
  return { fixture, element, set, pages, sizes, button, numbers };
}

describe('Paginator', () => {
  it('shows the range, the total, the page size and the navigation', async () => {
    const { element, numbers, button } = await render({
      page: 1,
      size: 20,
      totalElements: 57,
      totalPages: 3,
    });

    expect(element.textContent).toContain('Mostrando 21–40 de 57 servicios');
    expect(element.querySelector<HTMLSelectElement>('select')?.value).toBe('20');
    expect(
      Array.from(element.querySelectorAll('option')).map((option) => option.textContent?.trim()),
    ).toEqual(['20', '50', '100']);
    expect(numbers()).toEqual(['1', '2', '3']);
    expect(button('Página 2').getAttribute('aria-current')).toBe('page');
    expect(element.querySelector('nav')?.getAttribute('aria-label')).toBe('Paginación');
  });

  it('shows the last range partially filled', async () => {
    const { element } = await render({ page: 2, size: 20, totalElements: 57, totalPages: 3 });

    expect(element.textContent).toContain('Mostrando 41–57 de 57 servicios');
  });

  it('emits 0-based pages with previous, next and the page numbers', async () => {
    const { pages, button } = await render({ page: 1, size: 20, totalElements: 57, totalPages: 3 });

    button('Página siguiente').click();
    button('Página anterior').click();
    button('Página 3').click();
    button('Página 2').click(); // the current one: nothing

    expect(pages).toEqual([2, 0, 2]);
  });

  it('disables previous on the first page and next on the last one', async () => {
    const { set, button } = await render({ page: 0, size: 20, totalElements: 57, totalPages: 3 });

    expect(button('Página anterior').disabled).toBe(true);
    expect(button('Página siguiente').disabled).toBe(false);

    await set({ page: 2 });
    expect(button('Página anterior').disabled).toBe(false);
    expect(button('Página siguiente').disabled).toBe(true);
  });

  it('stays visible with a single page, with the navigation disabled', async () => {
    const { element, numbers, button } = await render({
      page: 0,
      size: 20,
      totalElements: 6,
      totalPages: 1,
    });

    expect(element.textContent).toContain('Mostrando 1–6 de 6 servicios');
    expect(numbers()).toEqual(['1']);
    expect(button('Página anterior').disabled).toBe(true);
    expect(button('Página siguiente').disabled).toBe(true);
  });

  it('shows gaps when there are many pages', async () => {
    const { numbers } = await render({ page: 5, size: 20, totalElements: 200, totalPages: 10 });

    expect(numbers()).toEqual(['1', '…', '5', '6', '7', '…', '10']);
  });

  it('emits a new page size', async () => {
    const { element, sizes } = await render({
      page: 3,
      size: 20,
      totalElements: 200,
      totalPages: 10,
    });
    const select = element.querySelector<HTMLSelectElement>('select')!;

    select.value = '100';
    select.dispatchEvent(new Event('change'));
    select.value = '20';
    select.dispatchEvent(new Event('change'));

    expect(sizes).toEqual([100]);
  });

  it('renders nothing without rows', async () => {
    const { element } = await render({ page: 0, size: 20, totalElements: 0, totalPages: 0 });

    expect(element.querySelector('.paginator')).toBeNull();
  });
});
