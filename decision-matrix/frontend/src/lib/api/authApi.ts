import { applyAuthSession, request } from './client';
import type { AuthSession, AuthUser } from './session';

export const authApi = {
  login: async (email: string, password: string) => {
    const session = await request<AuthSession>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      redirectOn401: false,
    });
    return applyAuthSession(session);
  },
  register: async (email: string, password: string, username: string) => {
    const session = await request<AuthSession>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, username }),
      redirectOn401: false,
    });
    return applyAuthSession(session);
  },
  logout: () =>
    request<{ message: string }>('/auth/logout', {
      method: 'POST',
      redirectOn401: false,
    }),
  me: () => request<AuthUser>('/auth/me', { redirectOn401: false }),
};
