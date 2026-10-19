import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_URL } from '@core/config/api-url';
import { firstValueFrom } from 'rxjs';
import { BusinessApi } from './business-api';

describe('BusinessApi', () => {
  it('posts the mapped DTO to /negocios/onboarding and returns the business', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_URL, useValue: 'http://api.test/api' },
      ],
    });
    const http = TestBed.inject(HttpTestingController);

    const result = firstValueFrom(
      TestBed.inject(BusinessApi).createOnboarding({
        name: 'Barbería El Estilo',
        address: 'Cra 25',
        phone: '300 123 4567',
        nit: '',
        email: null,
      }),
    );

    const req = http.expectOne('http://api.test/api/negocios/onboarding');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      name: 'Barbería El Estilo',
      address: 'Cra 25',
      phone: '3001234567',
      nit: null,
      email: null,
    });
    req.flush(
      {
        id: 'b1',
        name: 'Barbería El Estilo',
        address: 'Cra 25',
        phone: '3001234567',
        status: 'ACTIVE',
        timeZone: 'America/Bogota',
      },
      { status: 201, statusText: 'Created' },
    );

    expect(await result).toMatchObject({ id: 'b1', status: 'ACTIVE', nit: null });
    http.verify();
  });
});
