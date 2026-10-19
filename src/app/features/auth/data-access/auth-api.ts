import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_URL } from '@core/config/api-url';
import { Observable, map } from 'rxjs';
import { UserResponseDto } from '../models/register-user.dto';
import { toRegisterUserRequestDto, toUser } from '../models/user.mapper';
import { NewUser, User } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class AuthApi {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(API_URL);

  register(newUser: NewUser): Observable<User> {
    return this.http
      .post<UserResponseDto>(`${this.apiUrl}/auth/register`, toRegisterUserRequestDto(newUser))
      .pipe(map(toUser));
  }
}
