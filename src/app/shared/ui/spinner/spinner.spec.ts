import { TestBed } from '@angular/core/testing';
import { Spinner } from './spinner';

async function render(inputs: Partial<Record<'size' | 'tone', string>> = {}) {
  const fixture = TestBed.createComponent(Spinner);
  for (const [name, value] of Object.entries(inputs)) {
    fixture.componentRef.setInput(name, value);
  }
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('Spinner', () => {
  it('is hidden from assistive technology and medium brand by default', async () => {
    const spinner = await render();

    expect(spinner.getAttribute('aria-hidden')).toBe('true');
    expect(spinner.classList).toContain('spinner--md');
    expect(spinner.classList).toContain('spinner--brand');
  });

  it('takes the size and tone asked for', async () => {
    const spinner = await render({ size: 'lg', tone: 'current' });

    expect(spinner.classList).toContain('spinner--lg');
    expect(spinner.classList).toContain('spinner--current');
    expect(spinner.classList).not.toContain('spinner--md');
  });
});
