import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_URL } from '@core/config/api-url';
import { firstValueFrom } from 'rxjs';
import { EmployeesApi } from './employees-api';

describe('EmployeesApi', () => {
  function setup() {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_URL, useValue: 'http://api.test/api' },
      ],
    });
    return { api: TestBed.inject(EmployeesApi), http: TestBed.inject(HttpTestingController) };
  }

  it('gets the asked page of employees and maps it', async () => {
    const { api, http } = setup();

    const result = firstValueFrom(api.list({ page: 1, size: 50 }));

    const req = http.expectOne('http://api.test/api/empleados?page=1&size=50');
    expect(req.request.method).toBe('GET');
    req.flush({
      content: [
        {
          id: 'e1',
          firstName: 'Ana',
          lastName: 'López',
          phone: '3001234567',
          email: 'ana@correo.com',
          status: 'ACTIVE',
          services: [{ id: 's1', name: 'Corte' }],
        },
      ],
      page: 1,
      size: 50,
      totalElements: 51,
      totalPages: 2,
    });

    expect(await result).toEqual({
      items: [
        {
          id: 'e1',
          firstName: 'Ana',
          lastName: 'López',
          fullName: 'Ana López',
          phone: '3001234567',
          email: 'ana@correo.com',
          status: 'ACTIVE',
          services: [{ id: 's1', name: 'Corte' }],
        },
      ],
      page: 1,
      size: 50,
      totalElements: 51,
      totalPages: 2,
    });
    http.verify();
  });

  it('asks for the first page by default', () => {
    const { api, http } = setup();

    void firstValueFrom(api.list());

    http.expectOne('http://api.test/api/empleados?page=0&size=20');
    http.verify();
  });

  it('creates an employee with the mapped body and maps the answer', async () => {
    const { api, http } = setup();

    const result = firstValueFrom(
      api.create({
        firstName: ' Eva ',
        lastName: 'Ruiz',
        phone: '300 123 4567',
        email: 'Eva@Correo.com',
        status: 'ACTIVE',
        serviceIds: ['s1'],
      }),
    );

    const req = http.expectOne('http://api.test/api/empleados');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      firstName: 'Eva',
      lastName: 'Ruiz',
      phone: '3001234567',
      email: 'eva@correo.com',
      status: 'ACTIVE',
      serviceIds: ['s1'],
    });
    req.flush(
      { id: 'e9', firstName: 'Eva', lastName: 'Ruiz', status: 'ACTIVE', services: [] },
      { status: 201, statusText: 'Created' },
    );

    expect(await result).toMatchObject({ id: 'e9', fullName: 'Eva Ruiz' });
    http.verify();
  });

  it('gets the current data of one employee (HU-18)', async () => {
    const { api, http } = setup();

    const result = firstValueFrom(api.get('e/1'));

    const req = http.expectOne('http://api.test/api/empleados/e%2F1');
    expect(req.request.method).toBe('GET');
    req.flush({
      id: 'e/1',
      firstName: 'Ana',
      lastName: 'López',
      status: 'INACTIVE',
      services: [{ id: 's1', name: 'Corte' }],
    });

    expect(await result).toMatchObject({
      id: 'e/1',
      fullName: 'Ana López',
      status: 'INACTIVE',
      services: [{ id: 's1', name: 'Corte' }],
    });
    http.verify();
  });

  it('updates an employee with the same cleaned body as the creation (HU-18)', async () => {
    const { api, http } = setup();

    const result = firstValueFrom(
      api.update('e1', {
        firstName: 'Ana ',
        lastName: 'Gómez',
        phone: null,
        email: 'ANA@correo.com',
        status: 'INACTIVE',
        serviceIds: [],
      }),
    );

    const req = http.expectOne('http://api.test/api/empleados/e1');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      firstName: 'Ana',
      lastName: 'Gómez',
      phone: null,
      email: 'ana@correo.com',
      status: 'INACTIVE',
      serviceIds: [],
    });
    req.flush({ id: 'e1', firstName: 'Ana', lastName: 'Gómez', status: 'INACTIVE' });

    expect(await result).toMatchObject({ id: 'e1', fullName: 'Ana Gómez', services: [] });
    http.verify();
  });

  it('changes the status with PATCH and keeps only the status answered (HU-20)', async () => {
    const { api, http } = setup();

    const result = firstValueFrom(api.changeStatus('e/1', 'INACTIVE'));

    const req = http.expectOne('http://api.test/api/empleados/e%2F1/estado');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ status: 'INACTIVE' });
    req.flush({ id: 'e/1', firstName: 'Ana', lastName: 'López', status: 'INACTIVE' });

    expect(await result).toBe('INACTIVE');
    http.verify();
  });
});
