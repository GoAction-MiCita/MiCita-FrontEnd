/** Body of `POST /api/auth/login`. `username` also accepts the email. */
export interface LoginRequestDto {
  readonly username: string;
  readonly password: string;
}

/** Body of `POST /api/auth/refresh` and `POST /api/auth/logout`. */
export interface RefreshTokenRequestDto {
  readonly refreshToken: string;
}

/** 200 response of login and refresh. */
export interface TokenResponseDto {
  readonly accessToken: string;
  /** Present on login; on refresh only when the backend rotates it. */
  readonly refreshToken?: string | null;
  /** Some backends also expose the access token claim in the body. */
  readonly hasBusiness?: boolean;
  readonly tokenType?: string;
  readonly expiresIn?: number;
}
