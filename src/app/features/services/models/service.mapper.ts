import { FieldErrors } from '@shared/models/field-errors.model';
import { FIRST_PAGE, Paging } from '@shared/ui/paginator/paging';
import { ServiceFilters } from './service-filters';
import {
  CreateServiceRequestDto,
  EmployeeResponseDto,
  PageDto,
  ServiceEmployeeDto,
  ServiceResponseDto,
  UpdateServiceRequestDto,
} from './service.dto';
import {
  NewService,
  NewServiceField,
  SERVICE_STATUS,
  Service,
  ServiceEmployee,
  ServicePage,
  ServiceStatus,
} from './service.model';

/** Backend field name → form field name. Keep in sync with CreateServiceRequestDto. */
const FORM_FIELD_BY_DTO_FIELD: Readonly<Record<keyof CreateServiceRequestDto, NewServiceField>> = {
  name: 'name',
  description: 'description',
  durationMinutes: 'durationMinutes',
  price: 'price',
  status: 'status',
  employeeIds: 'employeeIds',
};

// HU-12 Back reports each rejected employee by its position in the list sent: employeeIds[2].
const EMPLOYEE_AT = /^employeeIds\[(\d+)\]$/;

/**
 * Query params of `GET /api/servicios`: `page` (0-based) and `size` (HU-15 Back), always sent so
 * the backend default size does not matter; `name` (contains, case-insensitive), `status` and
 * `employeeIds=a,b` (any of them) from HU-13 Back, left out when empty.
 */
export function toServiceListParams(
  filters: ServiceFilters,
  paging: Paging = FIRST_PAGE,
): Record<string, string> {
  const name = filters.name.trim();
  return {
    page: String(paging.page),
    size: String(paging.size),
    ...(name && { name }),
    ...(filters.status && { status: filters.status }),
    ...(filters.employeeIds.length > 0 && { employeeIds: filters.employeeIds.join(',') }),
  };
}

export function toServicePage(dto: PageDto<ServiceResponseDto>): ServicePage {
  return {
    items: (dto.content ?? []).map(toService),
    page: dto.page,
    size: dto.size,
    totalElements: dto.totalElements,
    totalPages: dto.totalPages,
  };
}

export function toService(dto: ServiceResponseDto): Service {
  return {
    id: dto.id,
    name: dto.name,
    description: emptyToNull(dto.description),
    durationMinutes: dto.durationMinutes ?? null,
    price: dto.price ?? null,
    status: toStatus(dto.status),
    employees: (dto.employees ?? []).map(toEmployee),
  };
}

export function toCreateServiceRequestDto(service: NewService): CreateServiceRequestDto {
  return {
    name: service.name.trim(),
    description: emptyToNull(service.description),
    durationMinutes: service.durationMinutes,
    price: service.price,
    status: service.status,
    employeeIds: [...new Set(service.employeeIds)],
  };
}

/** HU-10: same body as the creation; `employeeIds` replaces the whole association. */
export function toUpdateServiceRequestDto(service: NewService): UpdateServiceRequestDto {
  return toCreateServiceRequestDto(service);
}

export function toEmployees(dto: PageDto<EmployeeResponseDto>): readonly ServiceEmployee[] {
  return (dto.content ?? []).map((employee) => ({
    id: employee.id,
    name: `${employee.firstName} ${employee.lastName}`.trim(),
    photoUrl: null,
  }));
}

/** HU-12: ids of the employees a 400 rejected, from `employeeIds[i]` keys and the ids sent. */
export function toRejectedEmployeeIds(
  fieldErrors: FieldErrors,
  sentIds: readonly string[],
): readonly string[] {
  const ids = Object.keys(fieldErrors)
    .map((field) => EMPLOYEE_AT.exec(field))
    .map((match) => (match ? sentIds[Number(match[1])] : undefined))
    .filter((id): id is string => id !== undefined);
  return [...new Set(ids)];
}

/** HU-11: only the new status of the answer is used, whatever else it carries. */
export function toServiceStatus(dto: Pick<ServiceResponseDto, 'status'>): ServiceStatus {
  return toStatus(dto.status);
}

/**
 * Renames server field errors to form field names; unknown fields keep their original key.
 * Per-employee errors (`employeeIds[i]`) collapse into one message on the employees field.
 */
export function toNewServiceFieldErrors(fieldErrors: FieldErrors): FieldErrors {
  const entries = Object.entries(fieldErrors).map(([field, message]) => {
    if (EMPLOYEE_AT.test(field)) {
      return ['employeeIds', REJECTED_EMPLOYEES_MESSAGE] as const;
    }
    const formField = FORM_FIELD_BY_DTO_FIELD[field as keyof CreateServiceRequestDto];
    return [formField ?? field, message] as const;
  });
  return Object.fromEntries(entries);
}

export const REJECTED_EMPLOYEES_MESSAGE =
  'Algunos empleados ya no están disponibles. Quítalos e inténtalo de nuevo.';

function toEmployee(dto: ServiceEmployeeDto): ServiceEmployee {
  return { id: dto.id, name: dto.name, photoUrl: dto.photoUrl ?? null };
}

// The list never includes DELETED services (HU-08 Back); anything unexpected shows as inactive.
function toStatus(status: string): ServiceStatus {
  return status === SERVICE_STATUS.active ? SERVICE_STATUS.active : SERVICE_STATUS.inactive;
}

function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}
