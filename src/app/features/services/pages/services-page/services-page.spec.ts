import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthSession } from '@core/auth/auth-session';
import { ApiError } from '@core/http/api-error.model';
import { Notifier } from '@core/notifications/notifier';
import { EmployeesApi } from '@features/services/data-access/employees-api';
import { ServicesApi } from '@features/services/data-access/services-api';
import {
  DELETE_SERVICE_MESSAGES,
  futureAppointmentsMessage,
} from '@features/services/models/delete-service-failure';
import { SERVICE_FORM_MESSAGES } from '@features/services/models/service-form-failure';
import { NO_SERVICE_FILTERS, ServiceFilters } from '@features/services/models/service-filters';
import { SERVICE_STATUS_MESSAGES } from '@features/services/models/service-status-messages';
import { Service, ServicePage, ServiceStatus } from '@features/services/models/service.model';
import { SERVICES_ERROR_MESSAGES } from '@features/services/models/services-error';
import { Observable, of, Subject, throwError } from 'rxjs';
import ServicesPage, { SERVICES_PAGE_MESSAGES } from './services-page';

const page: ServicePage = {
  items: [
    {
      id: 's1',
      name: 'Barba',
      description: 'Arreglo de barba',
      durationMinutes: 20,
      price: 20000,
      status: 'ACTIVE',
      employees: [],
    },
  ],
  page: 0,
  size: 20,
  totalElements: 1,
  totalPages: 1,
};

const employees = [
  { id: 'e1', name: 'Ana López', photoUrl: null },
  { id: 'e2', name: 'Juan Pérez', photoUrl: null },
];

async function render(
  list: () => Observable<ServicePage>,
  {
    waitForData = true,
    create = (): Observable<Service> => of(page.items[0]),
    get = (): Observable<Service> => of(page.items[0]),
    update = (): Observable<Service> => of(page.items[0]),
    remove = (): Observable<void> => of(undefined),
    changeStatus = (_id: string, status: ServiceStatus): Observable<ServiceStatus> => of(status),
  } = {},
) {
  const spy = vi.fn(list);
  const createSpy = vi.fn(create);
  const getSpy = vi.fn(get);
  const updateSpy = vi.fn(update);
  const removeSpy = vi.fn(remove);
  const changeStatusSpy = vi.fn(changeStatus);
  const notifier = { success: vi.fn(), error: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      {
        provide: ServicesApi,
        useValue: {
          list: spy,
          create: createSpy,
          get: getSpy,
          update: updateSpy,
          remove: removeSpy,
          changeStatus: changeStatusSpy,
        },
      },
      { provide: AuthSession, useValue: { expire: vi.fn() } },
      { provide: EmployeesApi, useValue: { list: () => of(employees) } },
      provideRouter([]),
      { provide: Notifier, useValue: notifier },
    ],
  });
  const fixture = TestBed.createComponent(ServicesPage);
  if (waitForData) {
    await fixture.whenStable();
  } else {
    // whenStable() would wait for the pending request forever.
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();
  }
  return {
    fixture,
    element: fixture.nativeElement as HTMLElement,
    list: spy,
    create: createSpy,
    get: getSpy,
    update: updateSpy,
    remove: removeSpy,
    changeStatus: changeStatusSpy,
    notifier,
  };
}

function apiError(kind: ApiError['kind']): ApiError {
  return { kind, status: 0, message: 'internal details', fieldErrors: {} };
}

function button(element: HTMLElement, text: string): HTMLButtonElement {
  return Array.from(element.querySelectorAll('button')).find((b) => b.textContent?.includes(text))!;
}

function fillName(element: HTMLElement, value: string): void {
  const input = element.querySelector<HTMLInputElement>(
    'app-service-form-panel [formcontrolname="name"]',
  )!;
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

describe('ServicesPage', () => {
  it('shows a loading indicator while the list loads', async () => {
    const response = new Subject<ServicePage>();
    const { fixture, element } = await render(() => response.asObservable(), {
      waitForData: false,
    });

    expect(element.querySelector('[role="status"]')?.textContent).toContain('Cargando servicios');

    response.next(page);
    response.complete();
    await fixture.whenStable();

    expect(element.querySelector('[role="status"]')).toBeNull();
    expect(element.querySelector('app-services-table')).toBeTruthy();
  });

  it('shows the table with the services', async () => {
    const { element } = await render(() => of(page));

    expect(element.querySelector('h1')?.textContent).toContain('Gestión de servicios');
    expect(element.textContent).toContain('Barba');
    expect(element.textContent).toContain('$ 20.000');
  });

  it('shows the empty state with the add button', async () => {
    const { element } = await render(() => of({ ...page, items: [], totalElements: 0 }));

    expect(element.textContent).toContain('Aún no tienes servicios');
    const add = Array.from(element.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Agregar nuevo servicio'),
    );
    expect(add?.disabled).toBe(false);
  });

  it('shows the server error with a retry that reloads the list', async () => {
    let fail = true;
    const { fixture, element, list } = await render(() =>
      fail ? throwError(() => apiError('server')) : of(page),
    );

    expect(element.textContent).toContain(SERVICES_ERROR_MESSAGES.unexpected);
    expect(element.textContent).not.toContain('internal details');

    fail = false;
    const retry = Array.from(element.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Reintentar'),
    )!;
    retry.click();
    await fixture.whenStable();

    expect(list).toHaveBeenCalledTimes(2);
    expect(element.textContent).toContain('Barba');
  });

  it('explains a 403 (business required) without retry', async () => {
    const { element } = await render(() => throwError(() => apiError('forbidden')));

    expect(element.textContent).toContain(SERVICES_ERROR_MESSAGES.businessRequired);
    expect(element.textContent).not.toContain('Reintentar');
  });

  it('opens the panel from the empty state', async () => {
    const { fixture, element } = await render(() => of({ ...page, items: [], totalElements: 0 }));

    button(element, 'Agregar nuevo servicio').click();
    await fixture.whenStable();

    expect(element.querySelector('app-service-form-panel dialog')).toBeTruthy();
  });

  it('creates a service: closes the panel, reloads the list and confirms', async () => {
    const { fixture, element, list, create, notifier } = await render(() => of(page));

    button(element, 'Agregar servicio').click();
    await fixture.whenStable();
    fillName(element, 'Corte');
    button(element, 'Guardar').click();
    await fixture.whenStable();

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Corte', status: 'ACTIVE' }),
    );
    expect(element.querySelector('app-service-form-panel')).toBeNull();
    expect(list).toHaveBeenCalledTimes(2);
    expect(notifier.success).toHaveBeenCalledWith('Servicio creado');
  });

  it('keeps the panel open with the error on the name after a 409', async () => {
    const { fixture, element, list, notifier } = await render(() => of(page), {
      create: () => throwError(() => apiError('conflict')),
    });

    button(element, 'Agregar servicio').click();
    await fixture.whenStable();
    fillName(element, 'Barba');
    button(element, 'Guardar').click();
    await fixture.whenStable();

    expect(element.querySelector('app-service-form-panel')).toBeTruthy();
    expect(element.textContent).toContain(SERVICE_FORM_MESSAGES.duplicateName);
    expect(list).toHaveBeenCalledTimes(1);
    expect(notifier.success).not.toHaveBeenCalled();
  });

  it('opens a clean panel after closing one with an error', async () => {
    const { fixture, element } = await render(() => of(page), {
      create: () => throwError(() => apiError('server')),
    });

    button(element, 'Agregar servicio').click();
    await fixture.whenStable();
    fillName(element, 'Corte');
    button(element, 'Guardar').click();
    await fixture.whenStable();
    expect(element.textContent).toContain(SERVICE_FORM_MESSAGES.unexpected);

    button(element, 'Cancelar').click();
    await fixture.whenStable();
    expect(element.querySelector('app-service-form-panel')).toBeNull();

    button(element, 'Agregar servicio').click();
    await fixture.whenStable();
    expect(element.textContent).not.toContain(SERVICE_FORM_MESSAGES.unexpected);
  });
});

describe('ServicesPage · editar servicio (HU-10)', () => {
  const barba = page.items[0];

  async function openEdit(rendered: Awaited<ReturnType<typeof render>>) {
    rendered.element.querySelector<HTMLButtonElement>('button[aria-label="Editar Barba"]')!.click();
    await rendered.fixture.whenStable();
  }

  it('opens the panel with the current data from GET', async () => {
    const rendered = await render(() => of(page), {
      get: () => of({ ...barba, price: 22000 }),
    });

    await openEdit(rendered);

    expect(rendered.get).toHaveBeenCalledWith('s1');
    expect(rendered.element.querySelector('app-service-form-panel h2')?.textContent).toContain(
      'Editar servicio',
    );
    const price = rendered.element.querySelector<HTMLInputElement>('[formcontrolname="price"]');
    expect(price?.value).toBe('22.000');
  });

  it('saves with PUT, closes the panel, reloads the list and confirms', async () => {
    const rendered = await render(() => of(page));
    await openEdit(rendered);

    fillName(rendered.element, 'Barba clásica');
    button(rendered.element, 'Guardar').click();
    await rendered.fixture.whenStable();

    expect(rendered.update).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({ name: 'Barba clásica', employeeIds: [] }),
    );
    expect(rendered.create).not.toHaveBeenCalled();
    expect(rendered.element.querySelector('app-service-form-panel')).toBeNull();
    expect(rendered.list).toHaveBeenCalledTimes(2);
    expect(rendered.notifier.success).toHaveBeenCalledWith(SERVICES_PAGE_MESSAGES.updated);
  });

  it('keeps the panel open with the errors after a 409', async () => {
    const rendered = await render(() => of(page), {
      update: () => throwError(() => apiError('conflict')),
    });
    await openEdit(rendered);

    button(rendered.element, 'Guardar').click();
    await rendered.fixture.whenStable();

    expect(rendered.element.querySelector('app-service-form-panel')).toBeTruthy();
    expect(rendered.element.textContent).toContain(SERVICE_FORM_MESSAGES.updateTitle);
    expect(rendered.element.textContent).toContain(SERVICE_FORM_MESSAGES.duplicateName);
    expect(rendered.list).toHaveBeenCalledTimes(1);
  });

  it('keeps the panel open with the field errors after a 400', async () => {
    const rendered = await render(() => of(page), {
      update: () =>
        throwError(() => ({ ...apiError('validation'), fieldErrors: { name: 'Nombre inválido' } })),
    });
    await openEdit(rendered);

    button(rendered.element, 'Guardar').click();
    await rendered.fixture.whenStable();

    expect(rendered.element.querySelector('app-service-form-panel')).toBeTruthy();
    expect(rendered.element.textContent).toContain('Nombre inválido');
  });

  it.each([
    ['opening', { get: () => throwError(() => apiError('not-found')) }],
    ['saving', { update: () => throwError(() => apiError('not-found')) }],
  ])('on a 404 while %s: closes, says it no longer exists and reloads', async (_when, api) => {
    const rendered = await render(() => of(page), api);
    await openEdit(rendered);
    if (rendered.element.querySelector('app-service-form-panel')) {
      button(rendered.element, 'Guardar').click();
      await rendered.fixture.whenStable();
    }

    expect(rendered.element.querySelector('app-service-form-panel')).toBeNull();
    expect(rendered.notifier.error).toHaveBeenCalledWith(SERVICES_PAGE_MESSAGES.gone);
    expect(rendered.list).toHaveBeenCalledTimes(2);
  });

  it('sends nothing when closed without saving', async () => {
    const rendered = await render(() => of(page));
    await openEdit(rendered);

    button(rendered.element, 'Cancelar').click();
    await rendered.fixture.whenStable();

    expect(rendered.element.querySelector('app-service-form-panel')).toBeNull();
    expect(rendered.update).not.toHaveBeenCalled();
    expect(rendered.list).toHaveBeenCalledTimes(1);
  });

  it('ignores a GET that answers after the panel was closed', async () => {
    const response = new Subject<Service>();
    const rendered = await render(() => of(page), { get: () => response.asObservable() });
    await openEdit(rendered);

    button(rendered.element, 'Cancelar').click();
    rendered.fixture.detectChanges();
    response.error(apiError('not-found'));
    await rendered.fixture.whenStable();

    expect(rendered.element.querySelector('app-service-form-panel')).toBeNull();
    expect(rendered.notifier.error).not.toHaveBeenCalled();
  });

  it('opens a clean create panel after editing', async () => {
    const rendered = await render(() => of(page));
    await openEdit(rendered);
    button(rendered.element, 'Cancelar').click();
    await rendered.fixture.whenStable();

    button(rendered.element, 'Agregar servicio').click();
    await rendered.fixture.whenStable();

    expect(rendered.element.querySelector('app-service-form-panel h2')?.textContent).toContain(
      'Agregar servicio',
    );
    const name = rendered.element.querySelector<HTMLInputElement>(
      'app-service-form-panel [formcontrolname="name"]',
    );
    expect(name?.value).toBe('');
  });
});

describe('ServicesPage · eliminar servicio (HU-14)', () => {
  async function openDelete(rendered: Awaited<ReturnType<typeof render>>) {
    rendered.element
      .querySelector<HTMLButtonElement>('button[aria-label="Eliminar Barba"]')!
      .click();
    await rendered.fixture.whenStable();
  }

  const dialog = (element: HTMLElement) => element.querySelector('app-delete-service-dialog');

  it('asks for confirmation with the service name and sends nothing yet', async () => {
    const rendered = await render(() => of(page));

    await openDelete(rendered);

    expect(dialog(rendered.element)?.textContent).toContain('«Barba»');
    expect(rendered.remove).not.toHaveBeenCalled();
  });

  it('does not call the API when cancelled', async () => {
    const rendered = await render(() => of(page));
    await openDelete(rendered);

    button(rendered.element, 'Cancelar').click();
    await rendered.fixture.whenStable();

    expect(dialog(rendered.element)).toBeNull();
    expect(rendered.remove).not.toHaveBeenCalled();
    expect(rendered.list).toHaveBeenCalledTimes(1);
  });

  it('on 204: closes, reloads the list and confirms', async () => {
    const rendered = await render(() => of(page));
    await openDelete(rendered);

    button(rendered.element, 'Eliminar').click();
    await rendered.fixture.whenStable();

    expect(rendered.remove).toHaveBeenCalledWith('s1');
    expect(dialog(rendered.element)).toBeNull();
    expect(rendered.list).toHaveBeenCalledTimes(2);
    expect(rendered.notifier.success).toHaveBeenCalledWith(SERVICES_PAGE_MESSAGES.deleted);
  });

  it('on 409: keeps the dialog with the future appointments message and only "Cerrar"', async () => {
    const rendered = await render(() => of(page), {
      remove: () => throwError(() => apiError('conflict')),
    });
    await openDelete(rendered);

    button(rendered.element, 'Eliminar').click();
    await rendered.fixture.whenStable();

    const text = dialog(rendered.element)?.textContent ?? '';
    expect(text).toContain(DELETE_SERVICE_MESSAGES.blockedTitle);
    expect(text).toContain(futureAppointmentsMessage('Barba'));
    expect(text).not.toContain('internal details');
    const actions = Array.from(
      dialog(rendered.element)!.querySelectorAll('.delete-dialog__actions button'),
    ).map((b) => b.textContent?.trim());
    expect(actions).toEqual(['Cerrar']);
    expect(rendered.list).toHaveBeenCalledTimes(1);
    expect(rendered.notifier.success).not.toHaveBeenCalled();
  });

  it('on 404: closes, says it no longer exists and reloads', async () => {
    const rendered = await render(() => of(page), {
      remove: () => throwError(() => apiError('not-found')),
    });
    await openDelete(rendered);

    button(rendered.element, 'Eliminar').click();
    await rendered.fixture.whenStable();

    expect(dialog(rendered.element)).toBeNull();
    expect(rendered.notifier.error).toHaveBeenCalledWith(SERVICES_PAGE_MESSAGES.gone);
    expect(rendered.list).toHaveBeenCalledTimes(2);
  });
});

describe('ServicesPage · filtrar servicios (HU-13)', () => {
  async function renderAt(
    url: string,
    list: (filters?: ServiceFilters) => Observable<ServicePage>,
  ) {
    const listSpy = vi.fn(list);
    TestBed.configureTestingModule({
      providers: [
        { provide: ServicesApi, useValue: { list: listSpy } },
        { provide: AuthSession, useValue: { expire: vi.fn() } },
        { provide: EmployeesApi, useValue: { list: () => of(employees) } },
        { provide: Notifier, useValue: { success: vi.fn(), error: vi.fn() } },
        provideRouter(
          [{ path: 'servicios', component: ServicesPage }],
          withComponentInputBinding(),
        ),
      ],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    await harness.fixture.whenStable();
    const router = TestBed.inject(Router);
    return {
      harness,
      element: harness.routeNativeElement as HTMLElement,
      list: listSpy,
      url: () => router.url,
    };
  }

  const empty: ServicePage = { ...page, items: [], totalElements: 0, totalPages: 0 };

  it('reads the filters from the URL and sends them to the API', async () => {
    const { element, list } = await renderAt(
      '/servicios?name=bar&status=INACTIVE&employeeIds=e1,e2',
      () => of(page),
    );

    expect(list).toHaveBeenLastCalledWith({
      name: 'bar',
      status: 'INACTIVE',
      employeeIds: ['e1', 'e2'],
    });
    expect(element.querySelector<HTMLInputElement>('input[type="search"]')?.value).toBe('bar');
    expect(element.querySelector<HTMLSelectElement>('select')?.value).toBe('INACTIVE');
  });

  it('ignores an invalid status in the URL', async () => {
    const { list } = await renderAt('/servicios?status=DELETED', () => of(page));

    expect(list).toHaveBeenLastCalledWith(NO_SERVICE_FILTERS);
  });

  it('writes the chosen status to the URL and filters the list', async () => {
    const { harness, element, list, url } = await renderAt('/servicios', () => of(page));

    const select = element.querySelector<HTMLSelectElement>('select')!;
    select.value = 'ACTIVE';
    select.dispatchEvent(new Event('change'));
    await harness.fixture.whenStable();

    expect(url()).toBe('/servicios?status=ACTIVE');
    expect(list).toHaveBeenLastCalledWith({ name: '', status: 'ACTIVE', employeeIds: [] });
  });

  it('shows a filtered empty state with "Limpiar filtros" that reloads everything', async () => {
    const { harness, element, list, url } = await renderAt('/servicios?name=zzz', (filters) =>
      of(filters?.name ? empty : page),
    );

    expect(element.textContent).toContain('No encontramos servicios con esos filtros');
    expect(element.textContent).not.toContain('Aún no tienes servicios');

    button(element, 'Limpiar filtros').click();
    await harness.fixture.whenStable();

    expect(url()).toBe('/servicios');
    expect(list).toHaveBeenLastCalledWith(NO_SERVICE_FILTERS);
    expect(element.textContent).toContain('Barba');
  });

  it('keeps the "sin servicios" empty state, without filters bar, when there are none', async () => {
    const { element } = await renderAt('/servicios', () => of(empty));

    expect(element.textContent).toContain('Aún no tienes servicios');
    expect(element.querySelector('app-services-filter-bar')).toBeNull();
  });
});

describe('ServicesPage · activar o desactivar (HU-11)', () => {
  const badge = (element: HTMLElement) =>
    element
      .querySelector('app-services-table tbody tr .services-table__badge')
      ?.textContent?.trim();
  const toggleButton = (element: HTMLElement, label: string) =>
    element.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;

  it('deactivates without confirmation: badge Inactivo and the appointments notice', async () => {
    const rendered = await render(() => of(page));

    toggleButton(rendered.element, 'Desactivar Barba').click();
    await rendered.fixture.whenStable();

    expect(rendered.changeStatus).toHaveBeenCalledWith('s1', 'INACTIVE');
    expect(badge(rendered.element)).toBe('Inactivo');
    expect(rendered.notifier.success).toHaveBeenCalledWith(SERVICE_STATUS_MESSAGES.deactivated);
    expect(rendered.element.querySelector('dialog')).toBeNull();
    expect(rendered.list).toHaveBeenCalledTimes(1);
  });

  it('activates an inactive service', async () => {
    const rendered = await render(() =>
      of({ ...page, items: [{ ...page.items[0], status: 'INACTIVE' as const }] }),
    );

    toggleButton(rendered.element, 'Activar Barba').click();
    await rendered.fixture.whenStable();

    expect(badge(rendered.element)).toBe('Activo');
    expect(rendered.notifier.success).toHaveBeenCalledWith(SERVICE_STATUS_MESSAGES.activated);
  });

  it('keeps the old badge until the answer arrives and disables the toggle meanwhile', async () => {
    const response = new Subject<ServiceStatus>();
    const rendered = await render(() => of(page), { changeStatus: () => response.asObservable() });

    toggleButton(rendered.element, 'Desactivar Barba').click();
    rendered.fixture.detectChanges();

    expect(badge(rendered.element)).toBe('Activo');
    expect(toggleButton(rendered.element, 'Desactivar Barba').disabled).toBe(true);

    response.next('INACTIVE');
    response.complete();
    // The click handler awaits the store; whenStable() does not track that promise.
    await vi.waitFor(() => expect(badge(rendered.element)).toBe('Inactivo'));
    expect(toggleButton(rendered.element, 'Activar Barba').disabled).toBe(false);
  });

  it.each([
    ['not-found', SERVICE_STATUS_MESSAGES.notFound],
    ['server', SERVICE_STATUS_MESSAGES.unexpected],
  ] as const)('on %s: shows the message and keeps the previous status', async (kind, message) => {
    const rendered = await render(() => of(page), {
      changeStatus: () => throwError(() => apiError(kind)),
    });

    toggleButton(rendered.element, 'Desactivar Barba').click();
    await rendered.fixture.whenStable();

    expect(badge(rendered.element)).toBe('Activo');
    expect(rendered.notifier.error).toHaveBeenCalledWith(message);
    expect(rendered.notifier.success).not.toHaveBeenCalled();
    expect(toggleButton(rendered.element, 'Desactivar Barba').disabled).toBe(false);
  });
});

describe('ServicesPage · asociar empleados (HU-12)', () => {
  const picker = (element: HTMLElement) =>
    element.querySelector<HTMLElement>('app-service-form-panel app-employee-picker')!;

  async function choose(rendered: Awaited<ReturnType<typeof render>>, name: string) {
    picker(rendered.element).querySelector<HTMLButtonElement>('.picker__trigger')!.click();
    await rendered.fixture.whenStable();
    const option = Array.from(
      picker(rendered.element).querySelectorAll<HTMLLabelElement>('.picker__option'),
    ).find((label) => label.textContent?.includes(name))!;
    option.querySelector<HTMLInputElement>('input')!.click();
    await rendered.fixture.whenStable();
  }

  it('creates a service with the chosen employees', async () => {
    const rendered = await render(() => of(page));
    button(rendered.element, 'Agregar servicio').click();
    await rendered.fixture.whenStable();

    fillName(rendered.element, 'Corte');
    await choose(rendered, 'Juan Pérez');
    button(rendered.element, 'Guardar').click();
    await rendered.fixture.whenStable();

    expect(rendered.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Corte', employeeIds: ['e2'] }),
    );
  });

  it('marks the employees a 400 rejected and keeps the panel open', async () => {
    const rendered = await render(() => of(page), {
      create: () =>
        throwError(() => ({
          ...apiError('validation'),
          fieldErrors: { 'employeeIds[0]': 'El empleado no pertenece al negocio' },
        })),
    });
    button(rendered.element, 'Agregar servicio').click();
    await rendered.fixture.whenStable();

    fillName(rendered.element, 'Corte');
    await choose(rendered, 'Ana López');
    button(rendered.element, 'Guardar').click();
    await rendered.fixture.whenStable();

    const element = picker(rendered.element);
    expect(rendered.element.querySelector('app-service-form-panel')).toBeTruthy();
    expect(element.querySelector('.picker__chip--rejected')?.textContent).toContain('Ana López');
    expect(element.textContent).toContain('Algunos empleados ya no están disponibles');
    expect(rendered.element.textContent).not.toContain('El empleado no pertenece al negocio');
  });
});
