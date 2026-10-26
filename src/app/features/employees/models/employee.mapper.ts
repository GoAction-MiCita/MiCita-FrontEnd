import { FIRST_PAGE, Paging } from '@shared/ui/paginator/paging';
import { EmployeeResponseDto, PageDto } from './employee.dto';
import { EMPLOYEE_STATUS, Employee, EmployeePage, EmployeeStatus } from './employee.model';

/**
 * Query params of `GET /api/empleados`: `page` (0-based) and `size`, always sent so the backend
 * default size does not matter. HU-22 adds the filters.
 */
export function toEmployeeListParams(paging: Paging = FIRST_PAGE): Record<string, string> {
  return { page: String(paging.page), size: String(paging.size) };
}

export function toEmployeePage(dto: PageDto<EmployeeResponseDto>): EmployeePage {
  return {
    items: (dto.content ?? []).map(toEmployee),
    page: dto.page,
    size: dto.size,
    totalElements: dto.totalElements,
    totalPages: dto.totalPages,
  };
}

export function toEmployee(dto: EmployeeResponseDto): Employee {
  const firstName = dto.firstName?.trim() ?? '';
  const lastName = dto.lastName?.trim() ?? '';
  return {
    id: dto.id,
    firstName,
    lastName,
    fullName: [firstName, lastName].filter(Boolean).join(' '),
    phone: emptyToNull(dto.phone),
    email: emptyToNull(dto.email),
    status: toStatus(dto.status),
    services: (dto.services ?? []).map(({ id, name }) => ({ id, name })),
  };
}

// The list never includes DELETED employees (HU-16 Back); anything unexpected shows as inactive.
function toStatus(status: string): EmployeeStatus {
  return status === EMPLOYEE_STATUS.active ? EMPLOYEE_STATUS.active : EMPLOYEE_STATUS.inactive;
}

function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}
