import { Injectable } from '@angular/core';

const REFRESH_TOKEN_KEY = 'micita.refreshToken';

/**
 * Persists only the refresh token: sessionStorage by default (dies with the tab), localStorage
 * when the user chose "Recordarme". The access token never leaves memory (see AuthSession).
 */
@Injectable({ providedIn: 'root' })
export class TokenStorage {
  readRefreshToken(): string | null {
    return read(localStore()) ?? read(sessionStore());
  }

  /** True when the stored refresh token was saved with "Recordarme". */
  isRemembered(): boolean {
    return read(localStore()) !== null;
  }

  writeRefreshToken(token: string, remember: boolean): void {
    this.clear();
    try {
      (remember ? localStore() : sessionStore())?.setItem(REFRESH_TOKEN_KEY, token);
    } catch {
      // Storage full or blocked (private mode): the session lives only until reload.
    }
  }

  clear(): void {
    for (const store of [localStore(), sessionStore()]) {
      try {
        store?.removeItem(REFRESH_TOKEN_KEY);
      } catch {
        // Ignore blocked storage.
      }
    }
  }
}

function read(store: Storage | null): string | null {
  try {
    return store?.getItem(REFRESH_TOKEN_KEY) ?? null;
  } catch {
    return null;
  }
}

// Accessing the storage getters can throw when site data is blocked.
function localStore(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function sessionStore(): Storage | null {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}
