import { TestBed } from '@angular/core/testing';
import { EMPTY_VALUE } from '@shared/formatting/format';
import { Tag, TagList } from './tag-list';

async function render(tags: readonly Tag[], max?: number) {
  const fixture = TestBed.createComponent(TagList);
  fixture.componentRef.setInput('tags', tags);
  if (max !== undefined) {
    fixture.componentRef.setInput('max', max);
  }
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

const tags: Tag[] = [
  { id: 's1', name: 'Corte' },
  { id: 's2', name: 'Barba' },
  { id: 's3', name: 'Tinte' },
  { id: 's4', name: 'Uñas' },
];

describe('TagList', () => {
  it('shows up to max tags and a "+N" chip with the rest in its tooltip', async () => {
    const element = await render(tags);

    const items = Array.from(element.querySelectorAll('li')).map((li) => li.textContent?.trim());
    expect(items).toEqual(['Corte', 'Barba', '+2']);
    expect(element.querySelector('.tag-list__more')?.getAttribute('title')).toBe('Tinte, Uñas');
    expect(element.querySelector('ul')?.getAttribute('aria-label')).toBe(
      'Corte, Barba, Tinte, Uñas',
    );
  });

  it('shows every tag when they fit', async () => {
    const element = await render(tags.slice(0, 2), 3);

    expect(element.querySelectorAll('li')).toHaveLength(2);
    expect(element.querySelector('.tag-list__more')).toBeNull();
  });

  it('shows a dash without tags', async () => {
    const element = await render([]);

    expect(element.textContent?.trim()).toBe(EMPTY_VALUE);
    expect(element.querySelector('ul')).toBeNull();
  });
});
