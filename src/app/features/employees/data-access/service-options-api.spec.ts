import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_URL } from '@core/config/api-url';
import { firstValueFrom } from 'rxjs';
import { ServiceOptionsApi } from './service-options-api';

describe('ServiceOptionsApi', () => {
  it('gets every service of the business in one page and maps them', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_URL, useValue: 'http://api.test/api' },
      ],
    });
    const http = TestBed.inject(HttpTestingController);

    const result = firstValueFrom(TestBed.inject(ServiceOptionsApi).list());

    const req = http.expectOne('http://api.test/api/servicios?page=0&size=100');
    expect(req.request.method).toBe('GET');
    req.flush({
      content: [{ id: 's1', name: 'Corte', status: 'INACTIVE', price: 1 }],
      page: 0,
      size: 100,
      totalElements: 1,
      totalPages: 1,
    });

    expect(await result).toEqual([{ id: 's1', name: 'Corte', active: false }]);
    http.verify();
  });
});
