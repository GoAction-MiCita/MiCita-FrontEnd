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
import { EMPLOYEE_STATUS_MESSAGES } from '@features/employees/models/employee-status-messages';
import {
  DELETE_EMPLOYEE_MESSAGES,
  futureAppointmentsMessage,
} from '@features/employees/models/delete-employee-failure';
import {
  EmployeeFilters,
  hasEmployeeFilters,
  NO_EMPLOYEE_FILTERS,
} from '@features/employees/models/employee-filters';
import {
  Employee,
  EmployeePage,
  EmployeeStatus,
  ServiceOption,
} from '@features/employees/models/employee.model';
import { EMPLOYEES_ERROR_MESSAGES } from '@features/employees/models/employees-error';
import { FIRST_PAGE, Paging } from '@shared/ui/paginator/paging';
import { delay, map, NEVER, Observable, of, Subject, throwError } from 'rxjs';
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
  readonly changeStatus?: (id: string, status: EmployeeStatus) => Observable<EmployeeStatus>;
  readonly remove?: (id: string) => Observable<void>;
}

async function renderAt(
  url: string,
  list: (paging: Paging, filters: EmployeeFilters) => Observable<EmployeePage> = paged,
  create: () => Observable<Employee> = () => of(ana),
  edit: EditApi = {},
) {
  // `list` records the page only (most tests care about it); `filters` records the filters.
  const filtersSpy = vi.fn<(filters: EmployeeFilters) => void>();
  const listSpy = vi.fn((paging: Paging) =>
    list(paging, filtersSpy.mock.lastCall?.[0] ?? NO_EMPLOYEE_FILTERS),
  );
  const createSpy = vi.fn(create);
  const getSpy = vi.fn(edit.get ?? (() => of(ana)));
  const updateSpy = vi.fn(edit.update ?? (() => of(ana)));
  const removeSpy = vi.fn(edit.remove ?? (() => of(undefined)));
  const changeStatusSpy = vi.fn(
    edit.changeStatus ?? ((_id: string, status: EmployeeStatus) => of(status)),
  );
  const servicesSpy = vi.fn(() => of(services));
  const notifier = { success: vi.fn(), error: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      {
        provide: EmployeesApi,
        useValue: {
          list: (filters: EmployeeFilters, paging: Paging) => {
            filtersSpy(filters);
            return listSpy(paging);
          },
          create: createSpy,
          get: getSpy,
          update: updateSpy,
          changeStatus: changeStatusSpy,
          remove: removeSpy,
        },
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
    filters: filtersSpy,
    create: createSpy,
    get: getSpy,
    update: updateSpy,
    changeStatus: changeStatusSpy,
    remove: removeSpy,
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

  it('asks for the services once, for the filter bar (HU-22)', async () => {
    const { services } = await renderAt('/empleados');

    expect(services).toHaveBeenCalledTimes(1);
  });

  it('does not ask for the services when the business has no employees', async () => {
    const { services } = await renderAt('/empleados', () => of(emptyPage));

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

describe('EmployeesPage · activar o desactivar (HU-20)', () => {
  async function renderList(changeStatus?: EditApi['changeStatus']) {
    const page = await renderAt('/empleados', paged, undefined, { changeStatus });
    const toggle = () =>
      page
        .element()
        .querySelector<HTMLButtonElement>(
          'button[aria-label$="Ana López"][aria-label^="Desactivar"], button[aria-label$="Ana López"][aria-label^="Activar"]',
        )!;
    const badge = () =>
      page.element().querySelector('.employees-table__badge')?.textContent?.trim();
    const click = async () => {
      toggle().click();
      await page.harness.fixture.whenStable();
    };
    return { ...page, toggle, badge, click };
  }

  it('deactivates without confirmation: PATCH, Inactivo badge and the appointments notice', async () => {
    const { click, badge, toggle, changeStatus, notifier, list } = await renderList();
    const listCalls = list.mock.calls.length;

    await click();

    expect(changeStatus).toHaveBeenCalledWith('e1', 'INACTIVE');
    expect(badge()).toBe('Inactivo');
    expect(toggle().getAttribute('aria-label')).toBe('Activar Ana López');
    expect(notifier.success).toHaveBeenCalledWith(EMPLOYEE_STATUS_MESSAGES.deactivated);
    expect(list.mock.calls.length).toBe(listCalls);
  });

  it('activates an inactive employee', async () => {
    const { click, badge, changeStatus, notifier } = await renderList();
    await click();

    await click();

    expect(changeStatus).toHaveBeenLastCalledWith('e1', 'ACTIVE');
    expect(badge()).toBe('Activo');
    expect(notifier.success).toHaveBeenLastCalledWith(EMPLOYEE_STATUS_MESSAGES.activated);
  });

  it('disables the action of that employee while the request is in flight', async () => {
    const response = new Subject<EmployeeStatus>();
    const { toggle, harness, badge, changeStatus } = await renderList(() =>
      response.asObservable(),
    );

    toggle().click();
    await harness.fixture.whenStable();

    expect(toggle().getAttribute('aria-disabled')).toBe('true');
    toggle().click();
    expect(changeStatus).toHaveBeenCalledTimes(1);
    expect(badge()).toBe('Activo');

    response.next('INACTIVE');
    response.complete();
    // The page awaits the store, which frees the row in its finally: let both settle.
    await new Promise((resolve) => setTimeout(resolve));
    await harness.fixture.whenStable();

    expect(toggle().hasAttribute('aria-disabled')).toBe(false);
    expect(badge()).toBe('Inactivo');
  });

  it.each([
    ['not-found', EMPLOYEE_STATUS_MESSAGES.notFound, 1],
    ['server', EMPLOYEE_STATUS_MESSAGES.unexpected, 0],
  ] as const)(
    'on %s shows the message and keeps the previous status',
    async (kind, message, reloads) => {
      const { click, badge, toggle, notifier, list } = await renderList(() =>
        throwError(() => apiError(kind)),
      );
      const listCalls = list.mock.calls.length;

      await click();

      expect(notifier.error).toHaveBeenCalledWith(message);
      expect(notifier.success).not.toHaveBeenCalled();
      expect(badge()).toBe('Activo');
      expect(toggle().hasAttribute('aria-disabled')).toBe(false);
      // A 404 reloads the list so the employee that no longer exists disappears.
      expect(list.mock.calls.length).toBe(listCalls + reloads);
    },
  );
});

describe('EmployeesPage · eliminar (HU-21)', () => {
  async function openDelete(
    edit: EditApi = {},
    url = '/empleados',
    list: (paging: Paging) => Observable<EmployeePage> = paged,
  ) {
    const page = await renderAt(url, list, undefined, edit);
    page
      .element()
      .querySelector<HTMLButtonElement>('button[aria-label="Eliminar Ana López"]')!
      .click();
    await page.harness.fixture.whenStable();
    const dialog = () => page.element().querySelector('app-confirm-dialog');
    const button = (text: string) =>
      Array.from(dialog()?.querySelectorAll('button') ?? []).find(
        (b) => b.textContent?.trim() === text,
      );
    const press = async (text: string) => {
      button(text)!.click();
      await page.harness.fixture.whenStable();
      // The page awaits the store after the click: let it settle.
      await new Promise((resolve) => setTimeout(resolve));
      await page.harness.fixture.whenStable();
    };
    return { ...page, dialog, button, press };
  }

  const conflict = (): Observable<void> =>
    throwError(() => ({ kind: 'conflict', status: 409, message: null, fieldErrors: {} }));

  it('asks for confirmation with the name of the employee', async () => {
    const { dialog, remove } = await openDelete();

    expect(dialog()?.querySelector('h2')?.textContent).toContain('Eliminar empleado');
    expect(dialog()?.textContent).toContain('«Ana López»');
    expect(remove).not.toHaveBeenCalled();
  });

  it('does not call the API when cancelled', async () => {
    const { dialog, press, remove } = await openDelete();

    await press('Cancelar');

    expect(dialog()).toBeNull();
    expect(remove).not.toHaveBeenCalled();
  });

  it('on 204 closes, reloads the list without the employee and confirms', async () => {
    const { dialog, press, remove, list, notifier } = await openDelete();
    const listCalls = list.mock.calls.length;

    await press('Eliminar');

    expect(remove).toHaveBeenCalledWith('e1');
    expect(dialog()).toBeNull();
    expect(list.mock.calls.length).toBe(listCalls + 1);
    expect(notifier.success).toHaveBeenCalledWith(EMPLOYEES_PAGE_MESSAGES.deleted);
  });

  it('goes back a page when deleting the last employee of the last page', async () => {
    let total = 41;
    const shrinking = (paging: Paging) =>
      of({
        items: paging.page < Math.ceil(total / paging.size) ? [ana] : [],
        page: paging.page,
        size: paging.size,
        totalElements: total,
        totalPages: Math.ceil(total / paging.size),
      });
    const { press, url, list, harness } = await openDelete(
      {
        remove: () => {
          total = 40;
          return of(undefined);
        },
      },
      '/empleados?page=3',
      shrinking,
    );

    await press('Eliminar');
    await harness.fixture.whenStable();

    expect(url()).toBe('/empleados?page=2');
    expect(list).toHaveBeenLastCalledWith({ page: 1, size: 20 });
  });

  it('on 409 explains the future appointments and offers to deactivate instead', async () => {
    const { dialog, button, press, changeStatus, notifier, element } = await openDelete({
      remove: conflict,
    });

    await press('Eliminar');

    expect(dialog()?.textContent).toContain(DELETE_EMPLOYEE_MESSAGES.blockedTitle);
    expect(dialog()?.textContent).toContain(futureAppointmentsMessage(ana));
    expect(button('Eliminar')).toBeUndefined();
    expect(button('Cerrar')).toBeDefined();

    await press('Desactivar');

    expect(changeStatus).toHaveBeenCalledWith('e1', 'INACTIVE');
    expect(dialog()).toBeNull();
    expect(element().querySelector('.employees-table__badge')?.textContent?.trim()).toBe(
      'Inactivo',
    );
    expect(notifier.success).toHaveBeenCalledWith(EMPLOYEE_STATUS_MESSAGES.deactivated);
  });

  it('on 409 for an inactive employee only offers "Cerrar"', async () => {
    const inactive = (paging: Paging) =>
      paged(paging).pipe(
        map((page) => ({
          ...page,
          items: page.items.map((e) => ({ ...e, status: 'INACTIVE' as const })),
        })),
      );
    const { button, press } = await openDelete({ remove: conflict }, '/empleados', inactive);

    await press('Eliminar');

    expect(button('Desactivar')).toBeUndefined();
    expect(button('Cerrar')).toBeDefined();
  });

  it('on 404 closes and reloads the list', async () => {
    const { dialog, press, list, notifier } = await openDelete({
      remove: () => throwError(() => apiError('not-found')),
    });
    const listCalls = list.mock.calls.length;

    await press('Eliminar');

    expect(dialog()).toBeNull();
    expect(list.mock.calls.length).toBe(listCalls + 1);
    expect(notifier.error).toHaveBeenCalledWith(EMPLOYEES_PAGE_MESSAGES.gone);
  });

  it('does not open the confirmation while that employee is changing its status', async () => {
    const response = new Subject<EmployeeStatus>();
    const { element, harness, dialog, remove } = await openDelete({
      changeStatus: () => response.asObservable(),
    });
    // Close the dialog openDelete() opened, then start a status change and try again.
    Array.from(dialog()!.querySelectorAll('button'))
      .find((b) => b.textContent?.trim() === 'Cancelar')!
      .click();
    await harness.fixture.whenStable();

    element()
      .querySelector<HTMLButtonElement>('button[aria-label="Desactivar Ana López"]')!
      .click();
    await harness.fixture.whenStable();
    element().querySelector<HTMLButtonElement>('button[aria-label="Eliminar Ana López"]')!.click();
    await harness.fixture.whenStable();

    expect(dialog()).toBeNull();
    expect(remove).not.toHaveBeenCalled();

    response.next('INACTIVE');
    response.complete();
    await new Promise((resolve) => setTimeout(resolve));
    await harness.fixture.whenStable();
    element().querySelector<HTMLButtonElement>('button[aria-label="Eliminar Ana López"]')!.click();
    await harness.fixture.whenStable();

    expect(dialog()).not.toBeNull();
  });
});

describe('EmployeesPage · filtrar (HU-22)', () => {
  // 57 employees; with any filter only 3 match (one page).
  const filteredList = (paging: Paging, filters: EmployeeFilters): Observable<EmployeePage> =>
    hasEmployeeFilters(filters)
      ? of({ items: [ana], page: 0, size: paging.size, totalElements: 3, totalPages: 1 })
      : paged(paging);

  const filterBar = (element: HTMLElement) => element.querySelector('app-employees-filter-bar');

  it('shows the filter bar with the services of the business', async () => {
    const { element, harness } = await renderAt('/empleados');
    filterBar(element())!.querySelector<HTMLButtonElement>('.multi-select__trigger')!.click();
    await harness.fixture.whenStable();

    expect(filterBar(element())?.textContent).toContain('Corte');
    expect(filterBar(element())?.textContent).toContain('Tinte');
  });

  it('reads the filters from the URL and asks once with them', async () => {
    const { list, filters, element } = await renderAt(
      '/empleados?name=ana&status=INACTIVE&serviceIds=s1,s2&page=2',
      filteredList,
    );

    expect(list).toHaveBeenCalledTimes(1);
    expect(filters).toHaveBeenLastCalledWith({
      name: 'ana',
      status: 'INACTIVE',
      serviceIds: ['s1', 's2'],
    });
    expect(list).toHaveBeenLastCalledWith({ page: 1, size: 20 });
    expect(
      element().querySelector<HTMLSelectElement>('app-employees-filter-bar select')?.value,
    ).toBe('INACTIVE');
  });

  it('writes a new filter to the URL and goes back to the first page', async () => {
    const { element, harness, url, list, filters } = await renderAt(
      '/empleados?page=3',
      filteredList,
    );

    const status = element().querySelector<HTMLSelectElement>('app-employees-filter-bar select')!;
    status.value = 'ACTIVE';
    status.dispatchEvent(new Event('change'));
    await harness.fixture.whenStable();

    expect(url()).toBe('/empleados?status=ACTIVE');
    expect(filters).toHaveBeenLastCalledWith({ name: '', status: 'ACTIVE', serviceIds: [] });
    expect(list).toHaveBeenLastCalledWith({ page: 0, size: 20 });
  });

  it('combines filters', async () => {
    const { element, harness, url } = await renderAt('/empleados?name=ana', filteredList);

    const status = element().querySelector<HTMLSelectElement>('app-employees-filter-bar select')!;
    status.value = 'INACTIVE';
    status.dispatchEvent(new Event('change'));
    await harness.fixture.whenStable();

    expect(url()).toBe('/empleados?name=ana&status=INACTIVE');
  });

  it('shows a "no results" state, different from "no employees", that clears the filters', async () => {
    const { element, harness, url, filters } = await renderAt('/empleados?name=zzz', (paging, f) =>
      hasEmployeeFilters(f) ? of({ ...emptyPage, size: paging.size }) : paged(paging),
    );

    expect(element().textContent).toContain('No encontramos empleados con esos filtros');
    expect(element().textContent).not.toContain('Aún no tienes empleados');
    expect(filterBar(element())).not.toBeNull();

    Array.from(element().querySelectorAll<HTMLButtonElement>('.employees-page__empty button'))
      .find((b) => b.textContent?.includes('Limpiar filtros'))!
      .click();
    await harness.fixture.whenStable();

    expect(url()).toBe('/empleados');
    expect(filters).toHaveBeenLastCalledWith(NO_EMPLOYEE_FILTERS);
    expect(element().querySelector('app-employees-table')).not.toBeNull();
  });

  it('on a 400 for a service of the filter shows the error and drops that filter', async () => {
    const { harness, url, notifier, filters } = await renderAt(
      '/empleados?name=ana&serviceIds=ajeno',
      (paging, f) =>
        f.serviceIds.length > 0
          ? throwError(() => ({ ...apiError('validation'), fieldErrors: { 'serviceIds[0]': 'x' } }))
          : paged(paging),
    );
    await harness.fixture.whenStable();

    expect(notifier.error).toHaveBeenCalledWith(EMPLOYEES_ERROR_MESSAGES.invalidServiceFilter);
    expect(url()).toBe('/empleados?name=ana');
    expect(filters).toHaveBeenLastCalledWith({ name: 'ana', status: null, serviceIds: [] });
  });

  it('shows any other 400 as an error with retry, without touching the filters', async () => {
    const { element, url, notifier } = await renderAt('/empleados?name=ana', (paging, f) =>
      f.name ? throwError(() => apiError('validation')) : paged(paging),
    );

    expect(url()).toBe('/empleados?name=ana');
    expect(notifier.error).not.toHaveBeenCalled();
    expect(element().querySelector('app-alert')?.textContent).toContain(
      EMPLOYEES_ERROR_MESSAGES.unexpected,
    );
    expect(element().querySelector('.employees-page__retry')?.textContent).toContain('Reintentar');
  });

  it('does not show the filter bar while the first answer is pending, nor ask for services on a 403', async () => {
    // Created directly: the harness would wait for the answer that is meant to stay pending.
    const pending = new Subject<EmployeePage>();
    const services = vi.fn(() => of([]));
    TestBed.configureTestingModule({
      providers: [
        { provide: EmployeesApi, useValue: { list: () => pending } },
        { provide: ServiceOptionsApi, useValue: { list: services } },
        { provide: Notifier, useValue: { success: vi.fn(), error: vi.fn() } },
        provideRouter([]),
      ],
    });
    const fixture = TestBed.createComponent(EmployeesPage);
    await Promise.resolve();
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('[role="status"]')?.textContent).toContain('Cargando empleados');
    expect(filterBar(element)).toBeNull();

    pending.error(apiError('forbidden'));
    await Promise.resolve();
    fixture.detectChanges();

    expect(filterBar(element)).toBeNull();
    expect(services).not.toHaveBeenCalled();
  });

  it('keeps the filter bar while a new filter reloads the list', async () => {
    let calls = 0;
    const { element, harness } = await renderAt('/empleados', (paging) =>
      calls++ === 0 ? paged(paging) : paged(paging).pipe(delay(100)),
    );

    const status = element().querySelector<HTMLSelectElement>('app-employees-filter-bar select')!;
    status.value = 'ACTIVE';
    status.dispatchEvent(new Event('change'));
    // Midway: the second answer is still on its way.
    await new Promise((resolve) => setTimeout(resolve, 20));
    harness.fixture.detectChanges();

    expect(element().querySelector('[role="status"]')?.textContent).toContain('Cargando empleados');
    expect(filterBar(element())).not.toBeNull();

    await harness.fixture.whenStable();
    expect(element().querySelector('app-employees-table')).not.toBeNull();
  });
});
