import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_URL } from '@core/config/api-url';
import { FIRST_PAGE, Paging } from '@shared/ui/paginator/paging';
import { map, Observable } from 'rxjs';
import {
  EmployeeResponseDto,
  PageDto,
  UpdateEmployeeStatusRequestDto,
} from '../models/employee.dto';
import {
  toCreateEmployeeRequestDto,
  toEmployee,
  toEmployeeListParams,
  toEmployeePage,
  toEmployeeStatus,
  toUpdateEmployeeRequestDto,
} from '../models/employee.mapper';
import { Employee, EmployeePage, EmployeeStatus, NewEmployee } from '../models/employee.model';

@Injectable({ providedIn: 'root' })
export class EmployeesApi {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(API_URL);

  /** HU-16: one page of the business employees with their services, by last name and first name. */
  list(paging: Paging = FIRST_PAGE): Observable<EmployeePage> {
    return this.http
      .get<PageDto<EmployeeResponseDto>>(`${this.apiUrl}/empleados`, {
        params: toEmployeeListParams(paging),
      })
      .pipe(map(toEmployeePage));
  }

  /** HU-17: creates an employee in the business of the authenticated user (taken from the token). */
  create(employee: NewEmployee): Observable<Employee> {
    return this.http
      .post<EmployeeResponseDto>(`${this.apiUrl}/empleados`, toCreateEmployeeRequestDto(employee))
      .pipe(map(toEmployee));
  }

  /** HU-18: current data of one employee with its services. 404 if it no longer exists. */
  get(id: string): Observable<Employee> {
    return this.http.get<EmployeeResponseDto>(this.employeeUrl(id)).pipe(map(toEmployee));
  }

  /** HU-18: updates an employee; its `serviceIds` replace the whole list of services. */
  update(id: string, employee: NewEmployee): Observable<Employee> {
    return this.http
      .put<EmployeeResponseDto>(this.employeeUrl(id), toUpdateEmployeeRequestDto(employee))
      .pipe(map(toEmployee));
  }

  /** HU-20: ACTIVE ↔ INACTIVE; the answer carries the status now stored. */
  changeStatus(id: string, status: EmployeeStatus): Observable<EmployeeStatus> {
    const body: UpdateEmployeeStatusRequestDto = { status };
    return this.http
      .patch<EmployeeResponseDto>(`${this.employeeUrl(id)}/estado`, body)
      .pipe(map(toEmployeeStatus));
  }

  /** HU-21: logical delete (status DELETED). 204 on success, 409 with future appointments. */
  remove(id: string): Observable<void> {
    return this.http.delete<void>(this.employeeUrl(id));
  }

  private employeeUrl(id: string): string {
    return `${this.apiUrl}/empleados/${encodeURIComponent(id)}`;
  }
}
