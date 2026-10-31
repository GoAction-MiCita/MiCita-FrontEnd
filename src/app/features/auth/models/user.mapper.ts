import { FieldErrors } from '@shared/models/field-errors.model';
import { RegisterUserRequestDto, UserResponseDto } from './register-user.dto';
import { NewUser, NewUserField, User } from './user.model';

/** Backend field name → form field name. Keep in sync with RegisterUserRequestDto. */
const FORM_FIELD_BY_DTO_FIELD: Readonly<Record<keyof RegisterUserRequestDto, NewUserField>> = {
  firstName: 'firstName',
  lastName: 'lastName',
  address: 'address',
  phone: 'phone',
  email: 'email',
  username: 'username',
  password: 'password',
};

export function toRegisterUserRequestDto(newUser: NewUser): RegisterUserRequestDto {
  return {
    firstName: newUser.firstName.trim(),
    lastName: newUser.lastName.trim(),
    address: newUser.address.trim(),
    // Backend accepts an optional `+` and 7–15 digits: drop spaces, dashes and parentheses.
    phone: newUser.phone.replace(/[\s\-()]/g, ''),
    email: newUser.email.trim(),
    username: newUser.username.trim(),
    password: newUser.password,
  };
}

export function toUser(dto: UserResponseDto): User {
  return {
    id: dto.id,
    firstName: dto.firstName,
    lastName: dto.lastName,
    address: dto.address,
    phone: dto.phone,
    email: dto.email,
    username: dto.username,
  };
}

/** Renames server field errors to form field names; unknown fields keep their original key. */
export function toNewUserFieldErrors(fieldErrors: FieldErrors): FieldErrors {
  const entries = Object.entries(fieldErrors).map(([field, message]) => {
    // hasOwn: a server key such as `constructor` must not hit Object.prototype.
    const formField = Object.hasOwn(FORM_FIELD_BY_DTO_FIELD, field)
      ? FORM_FIELD_BY_DTO_FIELD[field as keyof RegisterUserRequestDto]
      : field;
    return [formField, message] as const;
  });
  return Object.fromEntries(entries);
}
