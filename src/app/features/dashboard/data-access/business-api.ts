import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_URL } from '@core/config/api-url';
import { map, Observable } from 'rxjs';
import { BusinessResponseDto } from '../models/business.dto';
import { toBusiness, toCreateBusinessRequestDto } from '../models/business.mapper';
import { Business, NewBusiness } from '../models/business.model';

@Injectable({ providedIn: 'root' })
export class BusinessApi {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(API_URL);

  /** HU-03: creates the business of the authenticated user (the backend takes it from the token). */
  createOnboarding(business: NewBusiness): Observable<Business> {
    return this.http
      .post<BusinessResponseDto>(
        `${this.apiUrl}/negocios/onboarding`,
        toCreateBusinessRequestDto(business),
      )
      .pipe(map(toBusiness));
  }
}
