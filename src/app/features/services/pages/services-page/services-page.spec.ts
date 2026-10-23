import { TestBed } from '@angular/core/testing';
import { ApiError } from '@core/http/api-error.model';
import { ServicesApi } from '@features/services/data-access/services-api';
import { ServicePage } from '@features/services/models/service.model';
import { SERVICES_ERROR_MESSAGES } from '@features/services/models/services-error';
import { Observable, of, Subject, throwError } from 'rxjs';
import ServicesPage from './services-page';

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

async function render(list: () => Observable<ServicePage>, { waitForData = true } = {}) {
  const spy = vi.fn(list);
  TestBed.configureTestingModule({
    providers: [{ provide: ServicesApi, useValue: { list: spy } }],
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
  return { fixture, element: fixture.nativeElement as HTMLElement, list: spy };
}

function apiError(kind: ApiError['kind']): ApiError {
  return { kind, status: 0, message: 'internal details', fieldErrors: {} };
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
    expect(add).toBeTruthy();
    expect(add?.disabled).toBe(true);
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

  it('keeps the add button disabled until HU-09', async () => {
    const { element } = await render(() => of(page));

    const add = Array.from(element.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Agregar servicio'),
    );
    expect(add?.disabled).toBe(true);
  });
});
