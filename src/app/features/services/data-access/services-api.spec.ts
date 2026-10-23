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

describe('ServicesApi.create', () => {
  it('posts the mapped request to /servicios and maps the created service', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_URL, useValue: 'http://api.test/api' },
      ],
    });
    const http = TestBed.inject(HttpTestingController);

    const result = firstValueFrom(
      TestBed.inject(ServicesApi).create({
        name: ' Corte ',
        description: null,
        durationMinutes: 45,
        price: 45000,
        status: 'ACTIVE',
      }),
    );

    const req = http.expectOne('http://api.test/api/servicios');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      name: 'Corte',
      description: null,
      durationMinutes: 45,
      price: 45000,
      status: 'ACTIVE',
    });
    req.flush({ id: 's9', name: 'Corte', durationMinutes: 45, price: 45000, status: 'ACTIVE' });

    expect(await result).toMatchObject({ id: 's9', name: 'Corte', employees: [] });
    http.verify();
  });
});

describe('ServicesApi edit (HU-10)', () => {
  function setup() {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_URL, useValue: 'http://api.test/api' },
      ],
    });
    return { api: TestBed.inject(ServicesApi), http: TestBed.inject(HttpTestingController) };
  }

  it('gets one service by id, encoding the id', async () => {
    const { api, http } = setup();

    const result = firstValueFrom(api.get('a/b?c'));

    const req = http.expectOne('http://api.test/api/servicios/a%2Fb%3Fc');
    expect(req.request.method).toBe('GET');
    req.flush({
      id: 'a/b?c',
      name: 'Barba',
      status: 'ACTIVE',
      employees: [{ id: 'e1', name: 'Ana López' }],
    });

    expect(await result).toMatchObject({
      id: 'a/b?c',
      employees: [{ id: 'e1', name: 'Ana López', photoUrl: null }],
    });
    http.verify();
  });

  it('puts the mapped request with the employee ids and maps the answer', async () => {
    const { api, http } = setup();

    const result = firstValueFrom(
      api.update(
        's1',
        {
          name: ' Barba ',
          description: null,
          durationMinutes: 30,
          price: 25000,
          status: 'INACTIVE',
        },
        ['e1'],
      ),
    );

    const req = http.expectOne('http://api.test/api/servicios/s1');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      name: 'Barba',
      description: null,
      durationMinutes: 30,
      price: 25000,
      status: 'INACTIVE',
      employeeIds: ['e1'],
    });
    req.flush({ id: 's1', name: 'Barba', price: 25000, status: 'INACTIVE' });

    expect(await result).toMatchObject({ id: 's1', status: 'INACTIVE', price: 25000 });
    http.verify();
  });
});

describe('ServicesApi.remove (HU-14)', () => {
  it('sends DELETE to /servicios/{id}, encoding the id', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_URL, useValue: 'http://api.test/api' },
      ],
    });
    const http = TestBed.inject(HttpTestingController);

    const result = firstValueFrom(TestBed.inject(ServicesApi).remove('a/b'), {
      defaultValue: undefined,
    });

    const req = http.expectOne('http://api.test/api/servicios/a%2Fb');
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });

    await expect(result).resolves.toBeNull();
    http.verify();
  });
});

describe('ServicesApi.list with filters (HU-13)', () => {
  it('sends the filters as query params', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_URL, useValue: 'http://api.test/api' },
      ],
    });
    const http = TestBed.inject(HttpTestingController);

    const result = firstValueFrom(
      TestBed.inject(ServicesApi).list({ name: 'cor & co', status: 'ACTIVE', employeeIds: ['e1'] }),
    );

    const req = http.expectOne((r) => r.url === 'http://api.test/api/servicios');
    expect(req.request.params.get('name')).toBe('cor & co');
    expect(req.request.params.get('status')).toBe('ACTIVE');
    expect(req.request.params.get('employeeIds')).toBe('e1');
    expect(req.request.params.has('page')).toBe(false);
    expect(req.request.urlWithParams).toContain('name=cor%20%26%20co');
    req.flush({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 });

    expect((await result).items).toEqual([]);
    http.verify();
  });
});
