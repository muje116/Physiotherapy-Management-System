import { describe, it, expect, vi, beforeEach } from 'vitest';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    get length() { return Object.keys(store).length; },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  };
})();

Object.defineProperty(global, 'localStorage', { value: localStorageMock });
Object.defineProperty(global, 'window', { value: global });

import {
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearTokens,
  setUser,
  getUser,
  isAuthenticated,
} from '../lib/auth';

describe('api-client', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  describe('getAccessToken', () => {
    it('returns token from localStorage', () => {
      localStorageMock.setItem('physiocore_access_token', 'test-token');
      expect(getAccessToken()).toBe('test-token');
    });

    it('returns null when no token stored', () => {
      expect(getAccessToken()).toBeNull();
    });
  });

  describe('setTokens', () => {
    it('stores only the short-lived access token', () => {
      setTokens('access-123', 'refresh-456');

      expect(localStorageMock.setItem).toHaveBeenCalledWith('physiocore_access_token', 'access-123');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('physiocore_refresh_token');
      expect(getAccessToken()).toBe('access-123');
      expect(getRefreshToken()).toBeNull();
    });
  });

  describe('clearTokens', () => {
    it('removes all auth tokens and user data', () => {
      setTokens('access', 'refresh');
      setUser({ id: 'u1' });
      clearTokens();

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('physiocore_access_token');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('physiocore_refresh_token');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('physiocore_user');
      expect(getAccessToken()).toBeNull();
    });
  });

  describe('isAuthenticated', () => {
    it('returns true when token exists', () => {
      setTokens('valid-token', 'refresh');
      expect(isAuthenticated()).toBe(true);
    });

    it('returns false when no token', () => {
      expect(isAuthenticated()).toBe(false);
    });
  });

  describe('getUser', () => {
    it('returns parsed user object from storage', () => {
      const user = { id: 'u1', email: 'test@test.com', role: 'ADMIN' };
      setUser(user);
      expect(getUser()).toEqual(user);
    });

    it('returns null when no user stored', () => {
      expect(getUser()).toBeNull();
    });

    it('handles corrupted JSON gracefully', () => {
      localStorageMock.getItem.mockReturnValueOnce('not-json');
      expect(getUser()).toBeNull();
    });
  });
});
