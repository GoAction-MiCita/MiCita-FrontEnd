import { TestBed } from '@angular/core/testing';
import RegisterPage from './register-page';

describe('RegisterPage', () => {
  it('renders the page title', async () => {
    const fixture = TestBed.createComponent(RegisterPage);
    await fixture.whenStable();

    const title = (fixture.nativeElement as HTMLElement).querySelector('h1');
    expect(title?.textContent).toContain('Crea tu cuenta');
  });
});
