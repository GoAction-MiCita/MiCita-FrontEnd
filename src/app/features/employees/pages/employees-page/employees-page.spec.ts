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

async function renderAt(
  url: string,
  list: (paging: Paging) => Observable<EmployeePage> = paged,
  create: () => Observable<Employee> = () => of(ana),
) {
  const listSpy = vi.fn(list);
  const createSpy = vi.fn(create);
  const servicesSpy = vi.fn(() => of(services));
  const notifier = { success: vi.fn(), error: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      { provide: EmployeesApi, useValue: { list: listSpy, create: createSpy } },
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
