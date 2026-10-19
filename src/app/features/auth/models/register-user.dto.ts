/** Body of `POST /api/auth/register` (backend `RegisterUserRequest`). */
export interface RegisterUserRequestDto {
  readonly firstName: string;
  readonly lastName: string;
  readonly address: string;
  readonly phone: string;
  readonly email: string;
  readonly username: string;
  readonly password: string;
}

/** 201 response of `POST /api/auth/register` (backend `UserResponse`). */
export interface UserResponseDto {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly address: string;
  readonly phone: string;
  readonly email: string;
  readonly username: string;
}
