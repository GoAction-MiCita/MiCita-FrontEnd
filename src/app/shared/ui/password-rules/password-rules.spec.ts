import { TestBed } from '@angular/core/testing';
import { PasswordRules } from './password-rules';

async function render(value: string) {
  const fixture = TestBed.createComponent(PasswordRules);
  fixture.componentRef.setInput('value', value);
  await fixture.whenStable();
  return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('li'));
}

describe('PasswordRules', () => {
  it('marks passed and pending rules', async () => {
    const items = await render('abcdef');

    const passed = items.filter((li) => li.classList.contains('password-rules__item--passed'));
    expect(passed.map((li) => li.textContent?.trim())).toEqual([
      expect.stringContaining('Mínimo 6 caracteres'),
      expect.stringContaining('Una letra minúscula'),
    ]);
    expect(items).toHaveLength(4);
  });

  it('shows the max length rule only when it fails', async () => {
    const items = await render(`Aa#${'x'.repeat(70)}`);

    expect(items.some((li) => li.textContent?.includes('Máximo 72'))).toBe(true);
  });
});
