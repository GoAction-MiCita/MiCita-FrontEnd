import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthSession } from '@core/auth/auth-session';
import { SessionUser } from '@core/auth/session.model';
import { ApiError } from '@core/http/api-error.model';
import { Observable, of, Subject, throwError } from 'rxjs';
import LoginPage from './login-page';

type LoginFn = (...args: unknown[]) => Observable<SessionUser>;

async function render(login: LoginFn, inputs: Record<string, unknown> = {}) {
  const loginSpy = vi.fn(login);
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: AuthSession, useValue: { login: loginSpy } }],
  });
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  const fixture = TestBed.createComponent(LoginPage);
  for (const [name, value] of Object.entries(inputs)) {
    fixture.componentRef.setInput(name, value);
  }
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;

  const fill = async (identifier: string, password: string, remember = false) => {
    const set = (name: string, value: string) => {
      const input = element.querySelector<HTMLInputElement>(`[formcontrolname="${name}"]`)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    };
    set('identifier', identifier);
    set('password', password);
    if (remember) {
      element.querySelector<HTMLInputElement>('[formcontrolname="remember"]')!.click();
    }
    await fixture.whenStable();
  };
  const submit = async () => {
    element.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await fixture.whenStable();
  };

  return { element, fill, submit, loginSpy, navigate };
}

const owner: SessionUser = { username: 'ana', hasBusiness: true };
const newcomer: SessionUser = { username: 'ana', hasBusiness: false };

describe('LoginPage', () => {
  it('does not call the API when fields are empty', async () => {
    const { element, submit, loginSpy } = await render(() => of(owner));

    await submit();

    expect(loginSpy).not.toHaveBeenCalled();
    expect(element.textContent).toContain('Ingresa tu usuario o correo electrónico');
    expect(element.textContent).toContain('Ingresa tu contraseña');
  });

  it('logs in with the remember flag and goes to the dashboard', async () => {
    const { fill, submit, loginSpy, navigate } = await render(() => of(owner));

    await fill('ana@correo.com', 'Abc#12', true);
    await submit();

    expect(loginSpy).toHaveBeenCalledWith(
      { identifier: 'ana@correo.com', password: 'Abc#12' },
      true,
    );
    expect(navigate).toHaveBeenCalledWith('/dashboard');
  });

  it('goes to onboarding when the user has no business', async () => {
    const { fill, submit, navigate } = await render(() => of(newcomer));

    await fill('ana', 'Abc#12');
    await submit();

    expect(navigate).toHaveBeenCalledWith('/onboarding');
  });

  it('returns to the private page the user tried to open', async () => {
    const { fill, submit, navigate } = await render(() => of(owner), {
      returnUrl: '/onboarding?step=2',
    });

    await fill('ana', 'Abc#12');
    await submit();

    expect(navigate).toHaveBeenCalledWith('/onboarding?step=2');
  });

  it.each(['//evil.com', 'https://evil.com', '/auth/register'])(
    'ignores the unsafe returnUrl %s',
    async (returnUrl) => {
      const { fill, submit, navigate } = await render(() => of(owner), { returnUrl });

      await fill('ana', 'Abc#12');
      await submit();

      expect(navigate).toHaveBeenCalledWith('/dashboard');
    },
  );

  it('shows a generic message on 401 without saying which field failed', async () => {
    const error: ApiError = {
      kind: 'unauthorized',
      status: 401,
      message: 'Bad password',
      fieldErrors: {},
    };
    const { element, fill, submit, navigate } = await render(() => throwError(() => error));

    await fill('ana', 'wrong');
    await submit();

    expect(element.textContent).toContain('Credenciales no válidas');
    expect(element.textContent).not.toContain('Bad password');
    expect(element.querySelectorAll('.form-field__message--error')).toHaveLength(0);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('disables the submit button while signing in', async () => {
    const response = new Subject<SessionUser>();
    const { element, fill, submit } = await render(() => response.asObservable());

    await fill('ana', 'Abc#12');
    await submit();

    expect(element.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
  });

  it('shows the success message after a registration', async () => {
    const { element } = await render(() => of(owner), { registered: true });

    expect(element.textContent).toContain('¡Tu cuenta fue creada!');
  });

  it('tells the user when the session expired', async () => {
    const { element } = await render(() => of(owner), { expired: true });

    expect(element.textContent).toContain('Tu sesión expiró');
  });
});
