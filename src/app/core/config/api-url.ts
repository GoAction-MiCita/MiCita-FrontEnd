import { InjectionToken } from '@angular/core';
import { environment } from '@env/environment';

/** Base URL of the backend API (already includes the `/api` prefix). */
export const API_URL = new InjectionToken<string>('API_URL', {
  providedIn: 'root',
  factory: () => environment.apiUrl,
});
