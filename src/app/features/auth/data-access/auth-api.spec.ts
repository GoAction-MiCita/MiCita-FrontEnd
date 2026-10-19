import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_URL } from '@core/config/api-url';
import { firstValueFrom } from 'rxjs';
import { NewUser } from '../models/user.model';
import { AuthApi } from './auth-api';

const newUser: NewUser = {
  firstName: 'Ana',
  lastName: 'López',
  address: 'Cra 25',
  phone: '300 123 4567',
  email: 'ana@correo.com',
  username: 'analopez',
  password: 'Abc#12',
};

describe('AuthApi', () => {
  let api: AuthApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_URL, useValue: 'http://api.test/api' },
      ],
    });
    api = TestBed.inject(AuthApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('posts the mapped DTO to /auth/register and returns the user', async () => {
    const result = firstValueFrom(api.register(newUser));

    const req = http.expectOne('http://api.test/api/auth/register');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ ...newUser, phone: '3001234567' });
    req.flush({ id: '1', ...newUser, password: undefined }, { status: 201, statusText: 'Created' });

    expect(await result).toMatchObject({ id: '1', username: 'analopez' });
  });
});
