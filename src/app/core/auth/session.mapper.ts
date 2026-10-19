import { decodeJwtPayload } from './jwt';
import { LoginRequestDto, TokenResponseDto } from './session.dto';
import { Credentials, IssuedSession, SessionUser } from './session.model';

export function toLoginRequestDto(credentials: Credentials): LoginRequestDto {
  return { username: credentials.identifier.trim(), password: credentials.password };
}

export function toIssuedSession(dto: TokenResponseDto): IssuedSession {
  return {
    accessToken: dto.accessToken,
    refreshToken: dto.refreshToken ?? null,
    user: toSessionUser(dto.accessToken, dto.hasBusiness),
  };
}

/** `hasBusiness` comes from the access token claim; the body value wins when present. */
export function toSessionUser(accessToken: string, hasBusiness?: boolean): SessionUser {
  const claims = decodeJwtPayload(accessToken) ?? {};
  const claimUsername = claims['username'] ?? claims['sub'];
  return {
    username: typeof claimUsername === 'string' ? claimUsername : null,
    hasBusiness: hasBusiness ?? claims['hasBusiness'] === true,
  };
}
