import {
  getAccessToken,
  type AuthSessionTokens,
} from '../authSession';
import { clearClientAuth, hasStoredCsrf, request, tryRefreshSession } from './client';

export type AuthUser = { id: string; email: string; username: string; role: string };
export type { ApiErrorBody, ApiHealthResponse } from './types';
export type AuthSession = AuthUser & AuthSessionTokens & { token_type?: string };

export const CSRF_STORAGE_KEY = 'csrf_token';

/** GitHub Pages base path, e.g. /Scaning/ */
export function appLoginPath(): string {
  const base = import.meta.env.BASE_URL || '/';
  return `${base}login`.replace(/\/{2,}/g, '/');
}

export function clearStoredCsrf(): void {
  sessionStorage.removeItem(CSRF_STORAGE_KEY);
}

/** End server session and local CSRF (switch account / logout). */
export async function clearServerSession(): Promise<void> {
  clearClientAuth();
  try {
    await request<{ message: string }>('/auth/logout', {
      method: 'POST',
      redirectOn401: false,
    });
  } catch {
    /* ignore — cookies may already be gone */
  }
}

/** Bearer + CSRF in sessionStorage after reload on cross-origin (GitHub Pages). */
export async function syncClientAuthSession(): Promise<boolean> {
  if (getAccessToken() && hasStoredCsrf()) return true;
  return tryRefreshSession();
}
