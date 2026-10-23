import { TestBed } from '@angular/core/testing';
import { AvatarGroup, AvatarPerson } from './avatar-group';

async function render(people: AvatarPerson[], max?: number) {
  const fixture = TestBed.createComponent(AvatarGroup);
  fixture.componentRef.setInput('people', people);
  if (max !== undefined) {
    fixture.componentRef.setInput('max', max);
  }
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

const person = (id: string, name: string, photoUrl: string | null = null): AvatarPerson => ({
  id,
  name,
  photoUrl,
});

describe('AvatarGroup', () => {
  it('shows a dash when there are no people', async () => {
    const element = await render([]);

    expect(element.textContent?.trim()).toBe('—');
  });

  it('shows photos or initials and a +N chip for the rest', async () => {
    const element = await render([
      person('1', 'Ana López', 'https://cdn.test/ana.jpg'),
      person('2', 'Juan Pérez'),
      person('3', 'María Gómez'),
      person('4', 'Pedro Ruiz'),
      person('5', 'Luisa Díaz'),
    ]);

    expect(element.querySelectorAll('img')).toHaveLength(1);
    expect(element.querySelector('img')?.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(element.textContent).toContain('JP');
    expect(element.textContent).toContain('+2');
    expect(element.querySelector('ul')?.getAttribute('aria-label')).toContain('Luisa Díaz');
  });

  it('renders names as text, never as HTML', async () => {
    const element = await render([person('1', '<img src=x onerror=alert(1)>')]);

    expect(element.querySelector('img')).toBeNull();
    expect(element.querySelector('li')?.getAttribute('title')).toBe('<img src=x onerror=alert(1)>');
  });

  it.each(['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', '//evil.com/x.png'])(
    'falls back to initials for the unsafe photo URL %s',
    async (url) => {
      const element = await render([person('1', 'Ana López', url)]);

      expect(element.querySelector('img')).toBeNull();
      expect(element.textContent).toContain('AL');
    },
  );

  it('accepts https and same-origin photo URLs', async () => {
    const element = await render([
      person('1', 'Ana', 'https://cdn.test/ana.jpg'),
      person('2', 'Juan', '/media/juan.jpg'),
    ]);

    expect(
      Array.from(element.querySelectorAll('img')).map((img) => img.getAttribute('src')),
    ).toEqual(['https://cdn.test/ana.jpg', '/media/juan.jpg']);
  });
});
