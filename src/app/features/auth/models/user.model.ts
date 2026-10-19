/** Registered user as used by the UI. */
export interface User {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly address: string;
  readonly phone: string;
  readonly email: string;
  readonly username: string;
}

/** Data captured by the registration form. */
export interface NewUser {
  readonly firstName: string;
  readonly lastName: string;
  readonly address: string;
  readonly phone: string;
  readonly email: string;
  readonly username: string;
  readonly password: string;
}

export type NewUserField = keyof NewUser;
