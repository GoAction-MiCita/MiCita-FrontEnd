import { PageDto, ServiceEmployeeDto, ServiceResponseDto } from './service.dto';
import {
  SERVICE_STATUS,
  Service,
  ServiceEmployee,
  ServicePage,
  ServiceStatus,
} from './service.model';

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
