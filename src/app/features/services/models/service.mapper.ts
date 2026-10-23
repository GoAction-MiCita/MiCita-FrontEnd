import { FieldErrors } from '@shared/models/field-errors.model';
import { ServiceFilters } from './service-filters';
import {
  CreateServiceRequestDto,
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
};

/**
 * Query params of `GET /api/servicios` (HU-13 Back): `name` (contains, case-insensitive),
 * `status` and `employeeIds=a,b` (any of them). Empty filters are left out, and no `page` is
 * sent, so every filter change starts again from the first page (the backend default).
 */
export function toServiceListParams(filters: ServiceFilters): Record<string, string> {
  const name = filters.name.trim();
  return {
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
  };
}

/** HU-10: the form has no employee picker yet (HU-12), so the current ids are sent back unchanged. */
export function toUpdateServiceRequestDto(
  service: NewService,
  employeeIds: readonly string[],
): UpdateServiceRequestDto {
  return { ...toCreateServiceRequestDto(service), employeeIds: [...employeeIds] };
}

/** Renames server field errors to form field names; unknown fields keep their original key. */
export function toNewServiceFieldErrors(fieldErrors: FieldErrors): FieldErrors {
  const entries = Object.entries(fieldErrors).map(([field, message]) => {
    const formField = FORM_FIELD_BY_DTO_FIELD[field as keyof CreateServiceRequestDto];
    return [formField ?? field, message] as const;
  });
  return Object.fromEntries(entries);
}

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
