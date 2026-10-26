import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_URL } from '@core/config/api-url';
import { map, Observable } from 'rxjs';
import { PageDto, ServiceOptionDto } from '../models/employee.dto';
import { toServiceOptions } from '../models/employee.mapper';
import { ServiceOption } from '../models/employee.model';

// The picker shows every service of the business in one list.
const PICKER_PAGE_SIZE = '100';

/**
 * HU-17: services of the business for the employee form, read from `GET /api/servicios` (E02).
 * Features cannot import each other, so this is not the services feature's own API.
 */
@Injectable({ providedIn: 'root' })
export class ServiceOptionsApi {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(API_URL);

  list(): Observable<readonly ServiceOption[]> {
    return this.http
      .get<PageDto<ServiceOptionDto>>(`${this.apiUrl}/servicios`, {
        params: { page: '0', size: PICKER_PAGE_SIZE },
      })
      .pipe(map(toServiceOptions));
  }
}
