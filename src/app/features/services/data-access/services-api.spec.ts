import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_URL } from '@core/config/api-url';
import { firstValueFrom } from 'rxjs';
import { ServicesApi } from './services-api';

describe('ServicesApi', () => {
  it('gets /servicios and maps the page', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_URL, useValue: 'http://api.test/api' },
      ],
    });
    const http = TestBed.inject(HttpTestingController);

    const result = firstValueFrom(TestBed.inject(ServicesApi).list());

    const req = http.expectOne('http://api.test/api/servicios');
    expect(req.request.method).toBe('GET');
    req.flush({
      content: [{ id: 's1', name: 'Barba', durationMinutes: 20, price: 20000, status: 'ACTIVE' }],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    });

    expect(await result).toMatchObject({
      totalElements: 1,
      items: [{ id: 's1', name: 'Barba', employees: [], description: null }],
    });
    http.verify();
  });
});
