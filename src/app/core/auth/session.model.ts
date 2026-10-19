/** What the login form sends. `identifier` is the username or the email. */
export interface Credentials {
  readonly identifier: string;
  readonly password: string;
}

/** Authenticated user, derived from the access token claims. */
export interface SessionUser {
  readonly username: string | null;
  readonly hasBusiness: boolean;
}

/** Tokens issued by login or refresh. `refreshToken` is null when the backend does not rotate it. */
export interface IssuedSession {
  readonly accessToken: string;
  readonly refreshToken: string | null;
  readonly user: SessionUser;
}
