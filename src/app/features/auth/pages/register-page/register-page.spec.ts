import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ApiError } from '@core/http/api-error.model';
import { Observable, of, Subject, throwError } from 'rxjs';
import { AuthApi } from '@features/auth/data-access/auth-api';
import { User } from '@features/auth/models/user.model';
import RegisterPage from './register-page';

const validValues = {
  firstName: 'Ana',
  lastName: 'López',
  address: 'Cra 25 # 45-67',
  phone: '300 123 4567',
  email: 'ana@correo.com',
  username: 'analopez',
  password: 'Abc#12',
};

async function render(register: (...args: unknown[]) => Observable<User>) {
  const registerSpy = vi.fn(register);
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: AuthApi, useValue: { register: registerSpy } }],
  });
  const fixture = TestBed.createComponent(RegisterPage);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;

  const input = (name: string) =>
    element.querySelector<HTMLInputElement>(`[formcontrolname="${name}"]`)!;
  const fill = async (values: Partial<typeof validValues>) => {
    for (const [name, value] of Object.entries(values)) {
      const field = input(name);
      field.value = value;
      field.dispatchEvent(new Event('input'));
      field.dispatchEvent(new Event('blur'));
    }
    await fixture.whenStable();
  };
  const submit = async () => {
    element.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await fixture.whenStable();
  };

  return { fixture, element, input, fill, submit, registerSpy };
}

function conflict(message: string): ApiError {
  return { kind: 'conflict', status: 409, message, fieldErrors: {} };
}

describe('RegisterPage', () => {
  it('renders every registration field', async () => {
    const { input } = await render(() => of());

    for (const name of Object.keys(validValues)) {
      expect(input(name)).toBeTruthy();
    }
  });

  it('marks errors per field and does not call the API when the form is invalid', async () => {
    const { element, fill, submit, registerSpy } = await render(() => of());

    await fill({ email: 'ana.lopez@correo' });
    await submit();

    expect(registerSpy).not.toHaveBeenCalled();
    expect(element.textContent).toContain('El nombre es obligatorio');
    expect(element.textContent).toContain('Ingresa un correo válido');
  });

  it('shows which password rules are not met', async () => {
    const { element, fill } = await render(() => of());

    await fill({ password: 'abcdef' });

    const pending = Array.from(element.querySelectorAll('.password-rules__item'))
      .filter((li) => !li.classList.contains('password-rules__item--passed'))
      .map((li) => li.textContent);
    expect(pending).toEqual([
      expect.stringContaining('Una letra mayúscula'),
      expect.stringContaining('Un carácter especial'),
    ]);
  });

  it('disables the submit button while the request is in flight', async () => {
    const response = new Subject<User>();
    const { element, fill, submit } = await render(() => response.asObservable());

    await fill(validValues);
    await submit();

    expect(element.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
  });

  it('redirects to login with a success flag on 201', async () => {
    const { fill, submit } = await render(() => of({ id: '1', ...validValues }));
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    await fill(validValues);
    await submit();

    expect(navigate).toHaveBeenCalledWith(['/auth/login'], { queryParams: { registered: true } });
  });

  it('marks the duplicated username on 409', async () => {
    const { element, fill, submit } = await render(() =>
      throwError(() => conflict('Username already exists')),
    );

    await fill(validValues);
    await submit();

    expect(element.textContent).toContain('No pudimos crear tu cuenta');
    expect(element.textContent).toContain('Este nombre de usuario ya está en uso');
    expect(element.textContent).not.toContain('Este correo ya está registrado');
  });

  it('shows server field errors on 400', async () => {
    const error: ApiError = {
      kind: 'validation',
      status: 400,
      message: 'Bad Request',
      fieldErrors: { phone: 'must have 7 to 15 digits, optionally starting with +' },
    };
    const { element, input, fill, submit } = await render(() => throwError(() => error));

    await fill(validValues);
    await submit();

    expect(element.textContent).toContain('Ingresa un teléfono válido (7 a 15 dígitos)');
    expect(element.textContent).not.toContain('must have');
    expect(input('phone').getAttribute('aria-invalid')).toBe('true');
  });

  it('applies the backend limits: blank text and too long values do not call the API', async () => {
    const { element, fill, submit, registerSpy } = await render(() => of({} as User));

    await fill({ ...validValues, firstName: '   ', username: 'u'.repeat(51) });
    await submit();

    expect(registerSpy).not.toHaveBeenCalled();
    expect(element.textContent).toContain('El nombre es obligatorio');
    expect(element.textContent).toContain('Debe tener máximo 50 caracteres');
  });
});
