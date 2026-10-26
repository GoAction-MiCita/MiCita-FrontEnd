import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_URL } from '@core/config/api-url';
import { map, Observable } from 'rxjs';
import { EmployeeResponseDto, PageDto } from '../models/service.dto';
import { toEmployees } from '../models/service.mapper';
import { ServiceEmployee } from '../models/service.model';

// The picker shows every employee of the business in one list.
const PICKER_PAGE_SIZE = '100';

/**
 * HU-12: employees of the business for the picker, read from `GET /api/empleados` (E03, HU-16).
 * Features cannot import each other, so the employees feature keeps its own API for its table.
 */
@Injectable({ providedIn: 'root' })
export class EmployeesApi {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(API_URL);

  list(): Observable<readonly ServiceEmployee[]> {
    return this.http
      .get<PageDto<EmployeeResponseDto>>(`${this.apiUrl}/empleados`, {
        params: { size: PICKER_PAGE_SIZE },
      })
      .pipe(map(toEmployees));
  }
}
