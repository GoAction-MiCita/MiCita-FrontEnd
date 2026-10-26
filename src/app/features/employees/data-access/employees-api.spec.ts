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
});
