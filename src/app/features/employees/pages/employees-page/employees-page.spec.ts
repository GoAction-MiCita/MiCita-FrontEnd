import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { ApiError } from '@core/http/api-error.model';
import { EmployeesApi } from '@features/employees/data-access/employees-api';
import { EmployeePage } from '@features/employees/models/employee.model';
import { EMPLOYEES_ERROR_MESSAGES } from '@features/employees/models/employees-error';
import { FIRST_PAGE, Paging } from '@shared/ui/paginator/paging';
import { NEVER, Observable, of, throwError } from 'rxjs';
import EmployeesPage from './employees-page';

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

async function renderAt(url: string, list: (paging: Paging) => Observable<EmployeePage> = paged) {
  const listSpy = vi.fn(list);
  TestBed.configureTestingModule({
    providers: [
      { provide: EmployeesApi, useValue: { list: listSpy } },
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
  return { harness, element, list: listSpy, url: () => router.url, button };
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

  it('keeps "Agregar empleado" visible but disabled until HU-17', async () => {
    const { element } = await renderAt('/empleados');

    const add = element().querySelector<HTMLButtonElement>('header button')!;
    expect(add.textContent).toContain('Agregar empleado');
    expect(add.disabled).toBe(true);
    expect(add.title).toBe('Próximamente');
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
