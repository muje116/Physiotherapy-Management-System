const ACCESS_TOKEN_KEY = 'physiocore_access_token';
const REFRESH_TOKEN_KEY = 'physiocore_refresh_token';
const USER_KEY = 'physiocore_user';

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  // Refresh tokens are now held in an httpOnly cookie by the API. Keep this
  // getter for older clients, but never read or persist the sensitive token.
  return null;
}

export function setTokens(accessToken: string, _refreshToken?: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function setUser(user: any) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getUser(): any {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function isAuthenticated(): boolean {
  return !!getAccessToken();
}
