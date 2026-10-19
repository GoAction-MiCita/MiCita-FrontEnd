import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_URL } from '@core/config/api-url';
import { map, Observable } from 'rxjs';
import { RefreshTokenRequestDto, TokenResponseDto } from './session.dto';
import { toIssuedSession, toLoginRequestDto } from './session.mapper';
import { Credentials, IssuedSession } from './session.model';

/** Endpoints that must never trigger a token refresh (see authInterceptor). */
export const PUBLIC_AUTH_PATHS = ['/auth/login', '/auth/register', '/auth/refresh'] as const;

@Injectable({ providedIn: 'root' })
export class SessionApi {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(API_URL);

  login(credentials: Credentials): Observable<IssuedSession> {
    return this.http
      .post<TokenResponseDto>(`${this.apiUrl}/auth/login`, toLoginRequestDto(credentials))
      .pipe(map(toIssuedSession));
  }

  refresh(refreshToken: string): Observable<IssuedSession> {
    const body: RefreshTokenRequestDto = { refreshToken };
    return this.http
      .post<TokenResponseDto>(`${this.apiUrl}/auth/refresh`, body)
      .pipe(map(toIssuedSession));
  }

  logout(refreshToken: string): Observable<void> {
    const body: RefreshTokenRequestDto = { refreshToken };
    return this.http.post<void>(`${this.apiUrl}/auth/logout`, body);
  }
}
