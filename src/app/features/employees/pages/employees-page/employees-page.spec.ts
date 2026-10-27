import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthSession } from '@core/auth/auth-session';
import { ApiError } from '@core/http/api-error.model';
import { Notifier } from '@core/notifications/notifier';
import { EmployeesApi } from '@features/employees/data-access/employees-api';
import { ServiceOptionsApi } from '@features/employees/data-access/service-options-api';
import { EMPLOYEE_FORM_MESSAGES } from '@features/employees/models/employee-form-failure';
import { Employee, EmployeePage, ServiceOption } from '@features/employees/models/employee.model';
import { EMPLOYEES_ERROR_MESSAGES } from '@features/employees/models/employees-error';
import { FIRST_PAGE, Paging } from '@shared/ui/paginator/paging';
import { NEVER, Observable, of, throwError } from 'rxjs';
import EmployeesPage, { EMPLOYEES_PAGE_MESSAGES } from './employees-page';

@Component({ template: 'dashboard' })
class FakeDashboard {}

const ana = {
  id: 'e1',
  firstName: 'Ana',
  lastName: 'López',
  fullName: 'Ana López',
  phone: '3001234567',
  email: 'ana@correo.com',
  status: 'ACTIVE',
  services: [{ id: 's1', name: 'Corte' }],
} as const;

// 57 employees: pages of 20 → 3 pages; the page asked for comes back with its totals.
const paged = (paging: Paging = FIRST_PAGE): Observable<EmployeePage> =>
  of({
    items: paging.page < Math.ceil(57 / paging.size) ? [ana] : [],
    page: paging.page,
    size: paging.size,
    totalElements: 57,
    totalPages: Math.ceil(57 / paging.size),
  });

const emptyPage: EmployeePage = { items: [], page: 0, size: 20, totalElements: 0, totalPages: 0 };

function apiError(kind: ApiError['kind']): ApiError {
  return { kind, status: 0, message: null, fieldErrors: {} };
}

const services: ServiceOption[] = [
  { id: 's1', name: 'Corte', active: true },
  { id: 's2', name: 'Tinte', active: false },
];

interface EditApi {
  readonly get?: (id: string) => Observable<Employee>;
  readonly update?: (id: string, changes: unknown) => Observable<Employee>;
}

async function renderAt(
  url: string,
  list: (paging: Paging) => Observable<EmployeePage> = paged,
  create: () => Observable<Employee> = () => of(ana),
  edit: EditApi = {},
) {
  const listSpy = vi.fn(list);
  const createSpy = vi.fn(create);
  const getSpy = vi.fn(edit.get ?? (() => of(ana)));
  const updateSpy = vi.fn(edit.update ?? (() => of(ana)));
  const servicesSpy = vi.fn(() => of(services));
  const notifier = { success: vi.fn(), error: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      {
        provide: EmployeesApi,
        useValue: { list: listSpy, create: createSpy, get: getSpy, update: updateSpy },
      },
      { provide: ServiceOptionsApi, useValue: { list: servicesSpy } },
      { provide: AuthSession, useValue: { expire: vi.fn() } },
      { provide: Notifier, useValue: notifier },
      provideRouter(
        [
          { path: 'empleados', component: EmployeesPage },
          { path: 'dashboard', component: FakeDashboard },
        ],
        withComponentInputBinding(),
      ),
    ],
  });
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl(url);
  await harness.fixture.whenStable();
  const router = TestBed.inject(Router);
  const element = () => harness.routeNativeElement as HTMLElement;
  const button = (label: string) =>
    element().querySelector<HTMLButtonElement>(`app-paginator button[aria-label="${label}"]`)!;
  return {
    harness,
    element,
    list: listSpy,
    create: createSpy,
    get: getSpy,
    update: updateSpy,
    services: servicesSpy,
    notifier,
    url: () => router.url,
    button,
  };
}

describe('EmployeesPage', () => {
  it('shows the table and the paginator', async () => {
    const { element } = await renderAt('/empleados');

    expect(element().querySelector('h1')?.textContent).toContain('Gestión de empleados');
    expect(element().querySelector('app-employees-table')?.textContent).toContain('Ana López');
    expect(element().querySelector('app-paginator')?.textContent).toContain(
      'Mostrando 1–20 de 57 empleados',
    );
  });

  it('does not ask for the services until the panel opens', async () => {
    const { services } = await renderAt('/empleados');

    expect(services).not.toHaveBeenCalled();
  });

  it('shows a loading indicator', async () => {
    // Created directly: the harness would wait for a response that never comes.
    TestBed.configureTestingModule({
      providers: [{ provide: EmployeesApi, useValue: { list: () => NEVER } }, provideRouter([])],
    });
    const fixture = TestBed.createComponent(EmployeesPage);
    await Promise.resolve();
    fixture.detectChanges();

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[role="status"]')?.textContent,
    ).toContain('Cargando empleados');
  });

  it('shows the empty state with "Agregar empleado"', async () => {
    const { element } = await renderAt('/empleados', () => of(emptyPage));

    const empty = element().querySelector('.employees-page__empty');
    expect(empty?.textContent).toContain('Aún no tienes empleados');
    expect(empty?.querySelector('button')?.textContent).toContain('Agregar empleado');
    expect(element().querySelector('header button')).toBeNull();
    expect(element().querySelector('app-paginator')).toBeNull();
  });

  it('shows the error with a retry that asks again', async () => {
    let fail = true;
    const { harness, element, list } = await renderAt('/empleados', (paging) =>
      fail ? throwError(() => apiError('network')) : paged(paging),
    );

    expect(element().querySelector('app-alert')?.textContent).toContain(
      EMPLOYEES_ERROR_MESSAGES.network,
    );

    fail = false;
    element().querySelector<HTMLButtonElement>('.employees-page__retry')!.click();
    await harness.fixture.whenStable();

    expect(list).toHaveBeenCalledTimes(2);
    expect(element().querySelector('app-employees-table')).not.toBeNull();
  });

  it('goes back to the onboarding (dashboard) on a 403', async () => {
    const { harness, url } = await renderAt('/empleados', () =>
      throwError(() => apiError('forbidden')),
    );
    await harness.fixture.whenStable();

    expect(url()).toBe('/dashboard');
  });

  it('reads page and size from the URL (1-based) and asks for them once (0-based)', async () => {
    const { list, element } = await renderAt('/empleados?page=2&size=50');

    expect(list).toHaveBeenCalledTimes(1);
    expect(list).toHaveBeenLastCalledWith({ page: 1, size: 50 });
    expect(element().querySelector('app-paginator')?.textContent).toContain(
      'Mostrando 51–57 de 57',
    );
  });

  it('changes page through the URL', async () => {
    const { harness, list, url, button } = await renderAt('/empleados');

    button('Página siguiente').click();
    await harness.fixture.whenStable();

    expect(url()).toBe('/empleados?page=2');
    expect(list).toHaveBeenLastCalledWith({ page: 1, size: 20 });
  });

  it('goes back to the first page when the page size changes', async () => {
    const { harness, element, list, url } = await renderAt('/empleados?page=3');

    const select = element().querySelector<HTMLSelectElement>('app-paginator select')!;
    select.value = '50';
    select.dispatchEvent(new Event('change'));
    await harness.fixture.whenStable();

    expect(url()).toBe('/empleados?size=50');
    expect(list).toHaveBeenLastCalledWith({ page: 0, size: 50 });
  });

  it('moves to the last page when the requested one is past the end', async () => {
    const { harness, url, list } = await renderAt('/empleados?page=9');
    await harness.fixture.whenStable();

    expect(url()).toBe('/empleados?page=3');
    expect(list).toHaveBeenLastCalledWith({ page: 2, size: 20 });
  });
});

describe('EmployeesPage · registrar (HU-17)', () => {
  async function openPanel(url = '/empleados', create?: () => Observable<Employee>) {
    const page = await renderAt(url, url === '/empleados' ? paged : () => of(emptyPage), create);
    const button = page
      .element()
      .querySelector<HTMLButtonElement>(
        url === '/empleados' ? 'header button' : '.employees-page__empty button',
      )!;
    button.click();
    await page.harness.fixture.whenStable();
    const panel = () => page.element().querySelector('app-employee-form-panel');
    const fill = async (values: Record<string, string>) => {
      for (const [name, value] of Object.entries(values)) {
        const input = panel()!.querySelector<HTMLInputElement>(`[formControlName="${name}"]`)!;
        input.value = value;
        input.dispatchEvent(new Event('input'));
      }
      await page.harness.fixture.whenStable();
    };
    const save = async () => {
      panel()!.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
      await page.harness.fixture.whenStable();
    };
    return { ...page, panel, fill, save };
  }

  it('opens the form from the header and loads the services once', async () => {
    const { panel, services } = await openPanel();

    expect(panel()?.textContent).toContain('Agregar empleado');
    expect(services).toHaveBeenCalledTimes(1);
  });

  it('opens the form from the empty state', async () => {
    const { panel } = await openPanel('/empleados?vacio');

    expect(panel()).not.toBeNull();
  });

  it('on 201 closes the form, reloads the list and confirms', async () => {
    const { panel, fill, save, create, list, notifier } = await openPanel();
    const listCalls = list.mock.calls.length;

    await fill({ firstName: 'Eva', lastName: 'Ruiz' });
    await save();

    expect(create).toHaveBeenCalledWith({
      firstName: 'Eva',
      lastName: 'Ruiz',
      phone: null,
      email: null,
      status: 'ACTIVE',
      serviceIds: [],
    });
    expect(panel()).toBeNull();
    expect(list.mock.calls.length).toBe(listCalls + 1);
    expect(notifier.success).toHaveBeenCalledWith(EMPLOYEES_PAGE_MESSAGES.created);
  });

  it('on 409 keeps the form open with the error on the duplicated field', async () => {
    const conflict: ApiError = {
      kind: 'conflict',
      status: 409,
      message: null,
      fieldErrors: { email: 'duplicado' },
    };
    const { panel, fill, save, notifier } = await openPanel('/empleados', () =>
      throwError(() => conflict),
    );

    await fill({ firstName: 'Eva', lastName: 'Ruiz', email: 'ana@correo.com' });
    await save();

    expect(panel()?.textContent).toContain(EMPLOYEE_FORM_MESSAGES.duplicateEmail);
    expect(notifier.success).not.toHaveBeenCalled();
  });
});

describe('EmployeesPage · editar (HU-18)', () => {
  async function openEdit(edit: EditApi = {}) {
    const page = await renderAt('/empleados', paged, undefined, edit);
    page
      .element()
      .querySelector<HTMLButtonElement>('button[aria-label="Editar Ana López"]')!
      .click();
    await page.harness.fixture.whenStable();
    const panel = () => page.element().querySelector('app-employee-form-panel');
    const control = (name: string) =>
      panel()!.querySelector<HTMLInputElement>(`[formControlName="${name}"]`)!;
    const save = async () => {
      panel()!.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
      await page.harness.fixture.whenStable();
    };
    return { ...page, panel, control, save };
  }

  const conflict: ApiError = {
    kind: 'conflict',
    status: 409,
    message: null,
    fieldErrors: { phone: 'duplicado' },
  };

  it('opens "Editar empleado" with the current data of the employee and its services', async () => {
    const current: Employee = { ...ana, firstName: 'Ana María', fullName: 'Ana María López' };
    const { panel, control, get, services } = await openEdit({ get: () => of(current) });

    expect(get).toHaveBeenCalledWith('e1');
    expect(services).toHaveBeenCalledTimes(1);
    expect(panel()?.querySelector('h2')?.textContent).toContain('Editar empleado');
    expect(control('firstName').value).toBe('Ana María');
    expect(control('email').value).toBe('ana@correo.com');
    expect(panel()?.querySelector('.multi-select__chip')?.textContent).toContain('Corte');
  });

  it('on 200 sends the PUT, closes the form, reloads the list and confirms', async () => {
    const { panel, control, save, update, list, notifier, harness } = await openEdit();
    const listCalls = list.mock.calls.length;

    control('lastName').value = 'Gómez';
    control('lastName').dispatchEvent(new Event('input'));
    await harness.fixture.whenStable();
    await save();

    expect(update).toHaveBeenCalledWith('e1', {
      firstName: 'Ana',
      lastName: 'Gómez',
      phone: '3001234567',
      email: 'ana@correo.com',
      status: 'ACTIVE',
      serviceIds: ['s1'],
    });
    expect(panel()).toBeNull();
    expect(list.mock.calls.length).toBe(listCalls + 1);
    expect(notifier.success).toHaveBeenCalledWith(EMPLOYEES_PAGE_MESSAGES.updated);
  });

  it('sends the resulting serviceIds when services are removed', async () => {
    const { panel, save, update, harness } = await openEdit();

    panel()!.querySelector<HTMLButtonElement>('button[aria-label="Quitar Corte"]')!.click();
    await harness.fixture.whenStable();
    await save();

    expect(update).toHaveBeenCalledWith('e1', expect.objectContaining({ serviceIds: [] }));
  });

  it('on 409 keeps the form open with the error on the duplicated field', async () => {
    const { panel, save, notifier } = await openEdit({ update: () => throwError(() => conflict) });

    await save();

    expect(panel()?.textContent).toContain(EMPLOYEE_FORM_MESSAGES.duplicatePhone);
    expect(panel()?.textContent).toContain(EMPLOYEE_FORM_MESSAGES.updateTitle);
    expect(notifier.success).not.toHaveBeenCalled();
  });

  it('on 404 when opening says the employee no longer exists and reloads the list', async () => {
    const { panel, list, notifier } = await openEdit({
      get: () => throwError(() => apiError('not-found')),
    });

    expect(panel()).toBeNull();
    expect(list).toHaveBeenCalledTimes(2);
    expect(notifier.error).toHaveBeenCalledWith(EMPLOYEES_PAGE_MESSAGES.gone);
  });

  it('keeps the form open with the alert, no fields and no save when loading fails', async () => {
    const { panel, notifier, update, harness } = await openEdit({
      get: () => throwError(() => apiError('server')),
    });

    const alert = panel()?.querySelector('app-alert')?.textContent ?? '';
    expect(alert).toContain(EMPLOYEE_FORM_MESSAGES.loadTitle);
    expect(alert).toContain(EMPLOYEE_FORM_MESSAGES.unexpected);
    expect(panel()?.querySelector('[formControlName="firstName"]')).toBeNull();
    const save = panel()!.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(save.textContent).toContain('Guardar cambios');
    expect(save.disabled).toBe(true);

    save.click();
    await harness.fixture.whenStable();
    expect(update).not.toHaveBeenCalled();
    expect(notifier.error).not.toHaveBeenCalled();
  });

  it('on 404 when saving closes the form, says so and reloads the list', async () => {
    const { panel, save, list, notifier } = await openEdit({
      update: () => throwError(() => apiError('not-found')),
    });
    const listCalls = list.mock.calls.length;

    await save();

    expect(panel()).toBeNull();
    expect(list.mock.calls.length).toBe(listCalls + 1);
    expect(notifier.error).toHaveBeenCalledWith(EMPLOYEES_PAGE_MESSAGES.gone);
  });

  it('opens "Agregar empleado" empty after editing', async () => {
    const { element, panel, control, harness } = await openEdit();

    panel()!
      .querySelectorAll<HTMLButtonElement>('button')
      .forEach((button) => button.textContent?.includes('Cancelar') && button.click());
    await harness.fixture.whenStable();
    element().querySelector<HTMLButtonElement>('header button')!.click();
    await harness.fixture.whenStable();

    expect(panel()?.querySelector('h2')?.textContent).toContain('Agregar empleado');
    expect(control('firstName').value).toBe('');
  });
});
