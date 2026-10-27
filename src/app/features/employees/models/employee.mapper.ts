import { FieldErrors } from '@shared/models/field-errors.model';
import { FIRST_PAGE, Paging } from '@shared/ui/paginator/paging';
import {
  CreateEmployeeRequestDto,
  EmployeeResponseDto,
  PageDto,
  ServiceOptionDto,
  UpdateEmployeeRequestDto,
} from './employee.dto';
import {
  EMPLOYEE_STATUS,
  Employee,
  EmployeePage,
  EmployeeStatus,
  NewEmployee,
  NewEmployeeField,
  ServiceOption,
} from './employee.model';

/** Backend field name → form field name. Keep in sync with CreateEmployeeRequestDto. */
const FORM_FIELD_BY_DTO_FIELD: Readonly<Record<keyof CreateEmployeeRequestDto, NewEmployeeField>> =
  {
    firstName: 'firstName',
    lastName: 'lastName',
    phone: 'phone',
    email: 'email',
    status: 'status',
    serviceIds: 'serviceIds',
  };

// HU-17 Back reports each rejected service by its position in the list sent: serviceIds[2].
const SERVICE_AT = /^serviceIds\[(\d+)\]$/;

export const REJECTED_SERVICES_MESSAGE =
  'Algunos servicios ya no están disponibles. Quítalos e inténtalo de nuevo.';

/** HU-17: trimmed names, phone without spaces, dashes or parentheses, and email in lowercase. */
export function toCreateEmployeeRequestDto(employee: NewEmployee): CreateEmployeeRequestDto {
  const phone = employee.phone?.replace(/[\s\-()]/g, '') ?? '';
  return {
    firstName: employee.firstName.trim(),
    lastName: employee.lastName.trim(),
    phone: phone === '' ? null : phone,
    email: emptyToNull(employee.email)?.toLowerCase() ?? null,
    status: employee.status,
    serviceIds: [...new Set(employee.serviceIds)],
  };
}

/** HU-18: same cleaning as HU-17. */
export function toUpdateEmployeeRequestDto(employee: NewEmployee): UpdateEmployeeRequestDto {
  return toCreateEmployeeRequestDto(employee);
}

/**
 * Renames server field errors to form field names; unknown fields keep their original key.
 * Per-service errors (`serviceIds[i]`) collapse into one message on the services field.
 */
export function toNewEmployeeFieldErrors(fieldErrors: FieldErrors): FieldErrors {
  const entries = Object.entries(fieldErrors).map(([field, message]) => {
    if (SERVICE_AT.test(field)) {
      return ['serviceIds', REJECTED_SERVICES_MESSAGE] as const;
    }
    const formField = FORM_FIELD_BY_DTO_FIELD[field as keyof CreateEmployeeRequestDto];
    return [formField ?? field, message] as const;
  });
  return Object.fromEntries(entries);
}

/** Ids of the services a 400 rejected, from `serviceIds[i]` keys and the ids sent. */
export function toRejectedServiceIds(
  fieldErrors: FieldErrors,
  sentIds: readonly string[],
): readonly string[] {
  const ids = Object.keys(fieldErrors)
    .map((field) => SERVICE_AT.exec(field))
    .map((match) => (match ? sentIds[Number(match[1])] : undefined))
    .filter((id): id is string => id !== undefined);
  return [...new Set(ids)];
}

/** Services of the business for the picker; the list never includes DELETED ones (HU-08 Back). */
export function toServiceOptions(dto: PageDto<ServiceOptionDto>): readonly ServiceOption[] {
  return (dto.content ?? []).map((service) => ({
    id: service.id,
    name: service.name,
    active: service.status === 'ACTIVE',
  }));
}

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

/** HU-20: only the new status of the answer is used, whatever else it carries. */
export function toEmployeeStatus(dto: Pick<EmployeeResponseDto, 'status'>): EmployeeStatus {
  return toStatus(dto.status);
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

/**
 * The list and the detail never include DELETED employees (HU-16/HU-18 Back). Case and spaces are
 * ignored: the edit form preloads this value, so a lowercase `active` must not be saved as
 * INACTIVE. Anything else unexpected shows as inactive.
 */
function toStatus(status: string | null | undefined): EmployeeStatus {
  return status?.trim().toUpperCase() === EMPLOYEE_STATUS.active
    ? EMPLOYEE_STATUS.active
    : EMPLOYEE_STATUS.inactive;
}

function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}
