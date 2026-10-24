import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_URL } from '@core/config/api-url';
import { FIRST_PAGE, Paging } from '@shared/ui/paginator/paging';
import { map, Observable } from 'rxjs';
import { NO_SERVICE_FILTERS, ServiceFilters } from '../models/service-filters';
import { PageDto, ServiceResponseDto, UpdateServiceStatusRequestDto } from '../models/service.dto';
import {
  toCreateServiceRequestDto,
  toService,
  toServiceListParams,
  toServicePage,
  toServiceStatus,
  toUpdateServiceRequestDto,
} from '../models/service.mapper';
import { NewService, Service, ServicePage, ServiceStatus } from '../models/service.model';

@Injectable({ providedIn: 'root' })
export class ServicesApi {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(API_URL);

  /** HU-08/HU-13/HU-15: one page of the business services, ordered by name and filtered. */
  list(
    filters: ServiceFilters = NO_SERVICE_FILTERS,
    paging: Paging = FIRST_PAGE,
  ): Observable<ServicePage> {
    return this.http
      .get<PageDto<ServiceResponseDto>>(`${this.apiUrl}/servicios`, {
        params: toServiceListParams(filters, paging),
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

  /** HU-10: updates a service; its `employeeIds` replace the whole employee list (HU-12). */
  update(id: string, service: NewService): Observable<Service> {
    return this.http
      .put<ServiceResponseDto>(this.serviceUrl(id), toUpdateServiceRequestDto(service))
      .pipe(map(toService));
  }

  /** HU-14: logical delete (status DELETED). 204 on success, 409 with future appointments. */
  remove(id: string): Observable<void> {
    return this.http.delete<void>(this.serviceUrl(id));
  }

  /** HU-11: ACTIVE ↔ INACTIVE; the answer carries the status now stored. */
  changeStatus(id: string, status: ServiceStatus): Observable<ServiceStatus> {
    const body: UpdateServiceStatusRequestDto = { status };
    return this.http
      .patch<ServiceResponseDto>(`${this.serviceUrl(id)}/estado`, body)
      .pipe(map(toServiceStatus));
  }

  private serviceUrl(id: string): string {
    return `${this.apiUrl}/servicios/${encodeURIComponent(id)}`;
  }
}
