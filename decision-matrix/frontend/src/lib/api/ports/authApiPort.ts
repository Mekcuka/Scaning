import { authApi } from '../authApi';

/** Current session user (read-only). */
export type AuthSessionApiPort = Pick<typeof authApi, 'me'>;

/** Login, register, and session refresh for auth store. */
export type AuthApiPort = Pick<typeof authApi, 'me' | 'login' | 'register'>;

export const defaultAuthSessionApi: AuthSessionApiPort = authApi;
export const defaultAuthApi: AuthApiPort = authApi;
