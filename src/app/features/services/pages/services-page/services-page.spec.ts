import { TestBed } from '@angular/core/testing';
import { AuthSession } from '@core/auth/auth-session';
import { ApiError } from '@core/http/api-error.model';
import { Notifier } from '@core/notifications/notifier';
import { ServicesApi } from '@features/services/data-access/services-api';
import {
  DELETE_SERVICE_MESSAGES,
  futureAppointmentsMessage,
} from '@features/services/models/delete-service-failure';
import { SERVICE_FORM_MESSAGES } from '@features/services/models/service-form-failure';
import { Service, ServicePage } from '@features/services/models/service.model';
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

async function render(
  list: () => Observable<ServicePage>,
  {
    waitForData = true,
    create = (): Observable<Service> => of(page.items[0]),
    get = (): Observable<Service> => of(page.items[0]),
    update = (): Observable<Service> => of(page.items[0]),
    remove = (): Observable<void> => of(undefined),
  } = {},
) {
  const spy = vi.fn(list);
  const createSpy = vi.fn(create);
  const getSpy = vi.fn(get);
  const updateSpy = vi.fn(update);
  const removeSpy = vi.fn(remove);
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
        },
      },
      { provide: AuthSession, useValue: { expire: vi.fn() } },
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
  const input = element.querySelector<HTMLInputElement>('[formcontrolname="name"]')!;
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
      expect.objectContaining({ name: 'Barba clásica' }),
      [],
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
    const name = rendered.element.querySelector<HTMLInputElement>('[formcontrolname="name"]');
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
