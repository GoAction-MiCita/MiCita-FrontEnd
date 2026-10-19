import { TestBed } from '@angular/core/testing';
import { TokenStorage } from './token-storage';

describe('TokenStorage', () => {
  let storage: TokenStorage;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    storage = TestBed.inject(TokenStorage);
  });

  it('keeps the refresh token in sessionStorage by default', () => {
    storage.writeRefreshToken('rt-1', false);

    expect(sessionStorage.length).toBe(1);
    expect(localStorage.length).toBe(0);
    expect(storage.readRefreshToken()).toBe('rt-1');
    expect(storage.isRemembered()).toBe(false);
  });

  it('uses localStorage when the user asked to be remembered', () => {
    storage.writeRefreshToken('rt-2', true);

    expect(localStorage.length).toBe(1);
    expect(sessionStorage.length).toBe(0);
    expect(storage.isRemembered()).toBe(true);
  });

  it('moves the token when the preference changes', () => {
    storage.writeRefreshToken('rt-1', true);
    storage.writeRefreshToken('rt-2', false);

    expect(localStorage.length).toBe(0);
    expect(storage.readRefreshToken()).toBe('rt-2');
  });

  it('clears both storages', () => {
    storage.writeRefreshToken('rt-1', true);
    storage.clear();

    expect(storage.readRefreshToken()).toBeNull();
  });
});
