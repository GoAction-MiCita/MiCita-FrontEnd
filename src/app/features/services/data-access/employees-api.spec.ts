import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_URL } from '@core/config/api-url';
import { firstValueFrom } from 'rxjs';
import { EmployeesApi } from './employees-api';

describe('EmployeesApi', () => {
  it('gets the employees of the business in one page and maps them', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_URL, useValue: 'http://api.test/api' },
      ],
    });
    const http = TestBed.inject(HttpTestingController);

    const result = firstValueFrom(TestBed.inject(EmployeesApi).list());

    const req = http.expectOne('http://api.test/api/empleados?size=100');
    expect(req.request.method).toBe('GET');
    req.flush({
      content: [
        { id: 'e1', firstName: 'Ana', lastName: 'López', status: 'ACTIVE', services: [] },
        { id: 'e2', firstName: 'Juan', lastName: 'Pérez', status: 'INACTIVE', services: [] },
      ],
      page: 0,
      size: 100,
      totalElements: 2,
      totalPages: 1,
    });

    expect(await result).toEqual([
      { id: 'e1', name: 'Ana López', photoUrl: null },
      { id: 'e2', name: 'Juan Pérez', photoUrl: null },
    ]);
    http.verify();
  });
});
