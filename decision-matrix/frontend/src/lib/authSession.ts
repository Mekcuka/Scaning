/** Bearer tokens for cross-origin API (GitHub Pages) when cookies are blocked. */

const ACCESS_KEY = 'access_token';
const REFRESH_KEY = 'refresh_token';

export type AuthSessionTokens = {
  access_token: string;
  refresh_token: string;
};

export function persistAuthTokens(tokens: AuthSessionTokens): void {
  sessionStorage.setItem(ACCESS_KEY, tokens.access_token);
  sessionStorage.setItem(REFRESH_KEY, tokens.refresh_token);
}

export function clearAuthTokens(): void {
  sessionStorage.removeItem(ACCESS_KEY);
  sessionStorage.removeItem(REFRESH_KEY);
}

export function getAccessToken(): string | null {
  return sessionStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  return sessionStorage.getItem(REFRESH_KEY);
}

export function hasAuthTokens(): boolean {
  return Boolean(getAccessToken());
}
