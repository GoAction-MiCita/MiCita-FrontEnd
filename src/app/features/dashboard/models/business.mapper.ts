import { FieldErrors } from '@shared/models/field-errors.model';
import { BusinessResponseDto, CreateBusinessRequestDto } from './business.dto';
import { Business, NewBusiness, NewBusinessField } from './business.model';

/** Backend field name → form field name. Keep in sync with CreateBusinessRequestDto. */
const FORM_FIELD_BY_DTO_FIELD: Readonly<Record<keyof CreateBusinessRequestDto, NewBusinessField>> =
  {
    name: 'name',
    address: 'address',
    phone: 'phone',
    nit: 'nit',
    email: 'email',
  };

export function toCreateBusinessRequestDto(business: NewBusiness): CreateBusinessRequestDto {
  return {
    name: business.name.trim(),
    address: business.address.trim(),
    // Backend accepts an optional `+` and 7–15 digits: drop spaces, dashes and parentheses.
    phone: business.phone.replace(/[\s\-()]/g, ''),
    nit: emptyToNull(business.nit),
    email: emptyToNull(business.email),
  };
}

export function toBusiness(dto: BusinessResponseDto): Business {
  return {
    id: dto.id,
    name: dto.name,
    address: dto.address,
    phone: dto.phone,
    nit: dto.nit ?? null,
    email: dto.email ?? null,
    status: dto.status,
    timeZone: dto.timeZone,
  };
}

/** Renames server field errors to form field names; unknown fields keep their original key. */
export function toNewBusinessFieldErrors(fieldErrors: FieldErrors): FieldErrors {
  const entries = Object.entries(fieldErrors).map(([field, message]) => {
    const formField = FORM_FIELD_BY_DTO_FIELD[field as keyof CreateBusinessRequestDto];
    return [formField ?? field, message] as const;
  });
  return Object.fromEntries(entries);
}

function emptyToNull(value: string | null): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}
