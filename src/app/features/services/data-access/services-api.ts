import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_URL } from '@core/config/api-url';
import { map, Observable } from 'rxjs';
import { PageDto, ServiceResponseDto } from '../models/service.dto';
import { toServicePage } from '../models/service.mapper';
import { ServicePage } from '../models/service.model';

@Injectable({ providedIn: 'root' })
export class ServicesApi {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(API_URL);

  /** HU-08: first page of the business services, ordered by name (filters/paging: HU-13/HU-15). */
  list(): Observable<ServicePage> {
    return this.http
      .get<PageDto<ServiceResponseDto>>(`${this.apiUrl}/servicios`)
      .pipe(map(toServicePage));
  }
}
