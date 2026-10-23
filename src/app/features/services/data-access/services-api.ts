import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_URL } from '@core/config/api-url';
import { map, Observable } from 'rxjs';
import { NO_SERVICE_FILTERS, ServiceFilters } from '../models/service-filters';
import { PageDto, ServiceResponseDto } from '../models/service.dto';
import {
  toCreateServiceRequestDto,
  toService,
  toServiceListParams,
  toServicePage,
  toUpdateServiceRequestDto,
} from '../models/service.mapper';
import { NewService, Service, ServicePage } from '../models/service.model';

@Injectable({ providedIn: 'root' })
export class ServicesApi {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(API_URL);

  /**
   * HU-08/HU-13: first page of the business services, ordered by name and filtered
   * (paging: HU-15).
   */
  list(filters: ServiceFilters = NO_SERVICE_FILTERS): Observable<ServicePage> {
    return this.http
      .get<PageDto<ServiceResponseDto>>(`${this.apiUrl}/servicios`, {
        params: toServiceListParams(filters),
      })
      .pipe(map(toServicePage));
  }

  /** HU-09: creates a service in the business of the authenticated user (taken from the token). */
  create(service: NewService): Observable<Service> {
    return this.http
      .post<ServiceResponseDto>(`${this.apiUrl}/servicios`, toCreateServiceRequestDto(service))
      .pipe(map(toService));
  }

  /** HU-10: current data of one service with its employees. 404 if it no longer exists. */
  get(id: string): Observable<Service> {
    return this.http.get<ServiceResponseDto>(this.serviceUrl(id)).pipe(map(toService));
  }

  /** HU-10: updates a service; `employeeIds` replaces its whole employee list. */
  update(id: string, service: NewService, employeeIds: readonly string[]): Observable<Service> {
    return this.http
      .put<ServiceResponseDto>(this.serviceUrl(id), toUpdateServiceRequestDto(service, employeeIds))
      .pipe(map(toService));
  }

  /** HU-14: logical delete (status DELETED). 204 on success, 409 with future appointments. */
  remove(id: string): Observable<void> {
    return this.http.delete<void>(this.serviceUrl(id));
  }

  private serviceUrl(id: string): string {
    return `${this.apiUrl}/servicios/${encodeURIComponent(id)}`;
  }
}
