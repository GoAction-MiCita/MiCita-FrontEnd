import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import LoginPage from './login-page';

async function render(registered: boolean) {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(LoginPage);
  fixture.componentRef.setInput('registered', registered);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('LoginPage', () => {
  it('shows the success message after a registration', async () => {
    expect((await render(true)).textContent).toContain('¡Tu cuenta fue creada!');
  });

  it('hides the success message otherwise', async () => {
    expect((await render(false)).textContent).not.toContain('¡Tu cuenta fue creada!');
  });
});
