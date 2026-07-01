import {
  clearAuthTokens,
  getAccessToken,
  getRefreshToken,
  persistAuthTokens,
} from '../authSession';
import { formatDemApiError } from '../demApiErrors';
import { taskLog, isMultiStepHttpFlowActive } from '../taskLog/store';
import {
  extractProjectIdFromPath,
  parseRequestBody,
  shouldLogHttpPath,
} from '../taskLog/loggablePaths';
import { CSRF_STORAGE_KEY, appLoginPath, type AuthSession, type AuthUser } from './session';

export const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';
export const REQUEST_TIMEOUT_MS = 12_000;

/** GitHub Pages + external API — sessionStorage Bearer, not same-origin cookies. */
export function isCrossOriginApi(): boolean {
  const apiUrl = import.meta.env.VITE_API_URL?.trim();
  if (!apiUrl?.startsWith('http')) return false;
  try {
    return new URL(apiUrl).origin !== window.location.origin;
  } catch {
    return false;
  }
}
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function storeCsrfFromResponse(res: Response): void {
  const token = res.headers.get('X-CSRF-Token');
  if (token) sessionStorage.setItem(CSRF_STORAGE_KEY, token);
}

export function clearClientAuth(): void {
  sessionStorage.removeItem(CSRF_STORAGE_KEY);
  clearAuthTokens();
}

export function getCsrfToken(): string | null {
  const stored = sessionStorage.getItem(CSRF_STORAGE_KEY);
  if (stored) return stored;
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function hasStoredCsrf(): boolean {
  return Boolean(sessionStorage.getItem(CSRF_STORAGE_KEY));
}

const AUTH_CSRF_EXEMPT = /^\/auth\/(login|register|refresh)$/;

function isCsrfErrorDetail(detail: unknown): boolean {
  return typeof detail === 'string' && detail.includes('CSRF');
}

export async function ensureMutatingSessionHeaders(path: string, method: string): Promise<void> {
  if (!MUTATING_METHODS.has(method) || AUTH_CSRF_EXEMPT.test(path)) return;
  if (!getAccessToken() || !hasStoredCsrf()) {
    await tryRefreshSession();
  }
}

let refreshInFlight: Promise<boolean> | null = null;

export async function tryRefreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const csrf = getCsrfToken();
        const refreshToken = getRefreshToken();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (csrf) headers['X-CSRF-Token'] = csrf;
        const access = getAccessToken();
        if (access) headers.Authorization = `Bearer ${access}`;
        const res = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers,
          body: refreshToken ? JSON.stringify({ refresh_token: refreshToken }) : undefined,
        });
        if (res.ok) {
          const data = (await res.json()) as AuthSession;
          persistAuthTokens(data);
        }
        storeCsrfFromResponse(res);
        return res.ok;
      } catch {
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

export type RequestOptions = RequestInit & {
  redirectOn401?: boolean;
  timeoutMs?: number;
  _retry?: boolean;
  /** Return null instead of throwing on HTTP 404. */
  allowNotFound?: boolean;
};

/** Legacy English `detail` from older API builds (e.g. after deploy lag). */
const API_ERROR_MESSAGES_RU: Record<string, string> = {
  'Invalid credentials': 'Неверный email или пароль',
  'Not authenticated': 'Сессия не найдена. Войдите снова',
  'Invalid refresh token': 'Сессия истекла. Войдите снова',
  'Invalid token': 'Недействительный токен. Войдите снова',
  'Invalid token type': 'Недействительный токен. Войдите снова',
  'User not found': 'Пользователь не найден',
  'Account deactivated': 'Учётная запись отключена',
  'Insufficient permissions': 'Недостаточно прав для этого действия',
  Unauthorized: 'Требуется вход в систему',
  'Method Not Allowed':
    'Сервер API устарел: нет GET /admin/assistant/llm-config. Перезапустите backend локально или задеployьте новую версию.',
  'Not Found':
    'Маршрут API не найден. Перезапустите backend (run_local.py) или задеployьте новую версию.',
  microservice_unavailable: 'Сервис расчёта временно недоступен. Попробуйте позже.',
  microservice_timeout: 'Сервис расчёта не ответил за отведённое время. Попробуйте позже.',
  microservice_error: 'Ошибка сервиса расчёта. Обратитесь к администратору.',
};

export function formatApiError(detail: unknown, fallback: string): string {
  if (typeof detail === 'string') {
    if (detail.includes('dem_')) {
      return formatDemApiError(detail);
    }
    if (detail === 'Insufficient permissions') return fallback;
    if (/Batch paste limit is/i.test(detail)) {
      const m = /got (\d+)/i.exec(detail);
      const count = m?.[1];
      return count
        ? `Слишком много объектов для одной вставки (${count}). Разбейте выделение на части.`
        : 'Слишком много объектов для одной вставки. Разбейте выделение на части.';
    }
    if (/Async jobs disabled/i.test(detail)) {
      return 'Фоновые задачи недоступны. Уменьшите выборку или перезапустите backend с ARQ worker.';
    }
    if (/Too many wells \((\d+)\); maximum (\d+) for pad placement/i.test(detail)) {
      const m = /Too many wells \((\d+)\); maximum (\d+) for pad placement/i.exec(detail);
      const count = m?.[1];
      const max = m?.[2] ?? '20';
      return count
        ? `Слишком много забоев (${count}). За один расчёт кустования — не более ${max}. Уберите лишние из списка.`
        : `Слишком много забоев. За один расчёт кустования — не более ${max}.`;
    }
    return API_ERROR_MESSAGES_RU[detail] ?? detail;
  }
  if (Array.isArray(detail)) {
    const parts = detail.map((item) => {
      if (item && typeof item === 'object' && 'msg' in item) {
        const loc = (item as { loc?: unknown[] }).loc;
        const field =
          Array.isArray(loc) && loc.length > 0
            ? String(loc[loc.length - 1])
            : null;
        let msg = String((item as { msg: string }).msg);
        if (/Batch paste limit is/i.test(msg)) {
          msg = formatApiError(msg.replace(/^Value error,\s*/i, ''), fallback);
        }
        return field ? `${field}: ${msg}` : msg;
      }
      return JSON.stringify(item);
    });
    return parts.join('; ') || fallback;
  }
  if (detail && typeof detail === 'object') {
    const obj = detail as Record<string, unknown>;
    if (typeof obj.message === 'string' && obj.message.includes('active job')) {
      return 'В проекте уже выполняется фоновая задача. Дождитесь завершения или отмените её в «Журнале задач».';
    }
    return JSON.stringify(detail);
  }
  return fallback;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { redirectOn401 = true, timeoutMs, _retry = false, allowNotFound = false, ...fetchOptions } = options;
  const method = (fetchOptions.method ?? 'GET').toUpperCase();
  await ensureMutatingSessionHeaders(path, method);
  const headers: Record<string, string> = {
    ...(fetchOptions.headers as Record<string, string>),
  };
  const isForm = fetchOptions.body instanceof FormData;
  if (!isForm) {
    headers['Content-Type'] = 'application/json';
  }
  if (MUTATING_METHODS.has(method)) {
    const csrf = getCsrfToken();
    if (csrf) headers['X-CSRF-Token'] = csrf;
  }
  const accessToken = getAccessToken();
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs ?? REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...fetchOptions,
      headers,
      credentials: 'include',
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      const ms = timeoutMs ?? REQUEST_TIMEOUT_MS;
      throw new Error(
        ms > REQUEST_TIMEOUT_MS
          ? `Операция заняла больше ${Math.round(ms / 1000)} с. Попробуйте ещё раз или уменьшите группу.`
          : 'Сервер не отвечает. Запустите API (backend) и базу данных.',
      );
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  if (res.status === 401) {
    const authRetryAllowed =
      !_retry && path !== '/auth/refresh' && path !== '/auth/login' && path !== '/auth/register';
    if (authRetryAllowed && (path === '/auth/me' || (redirectOn401 && !path.startsWith('/auth/')))) {
      const refreshed = await tryRefreshSession();
      if (refreshed) {
        return request<T>(path, { ...options, _retry: true });
      }
    }
    if (redirectOn401) {
      clearClientAuth();
      window.dispatchEvent(new CustomEvent('sppr:auth-lost'));
      const pathName = window.location.pathname;
      const onAuthPage = /\/(login|register)\/?$/.test(pathName);
      if (!onAuthPage) {
        window.location.href = appLoginPath();
      }
    }
    const err = await res.json().catch(() => ({ detail: null }));
    throw new Error(formatApiError(err.detail, 'Требуется вход в систему'));
  }
  if (res.status === 403) {
    const err = await res.json().catch(() => ({ detail: null }));
    if (!_retry && isCsrfErrorDetail(err.detail) && (await tryRefreshSession())) {
      return request<T>(path, { ...options, _retry: true });
    }
    throw new Error(formatApiError(err.detail, 'Недостаточно прав для этого действия'));
  }
  if (res.status === 404 && allowNotFound) {
    return null as T;
  }
  const projectId = extractProjectIdFromPath(path);
  const logHttp = Boolean(projectId && shouldLogHttpPath(path, method));
  const requestBody = logHttp ? parseRequestBody(fetchOptions.body ?? null) : null;

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    if (logHttp && projectId) {
      taskLog.recordHttpStep({
        projectId,
        method,
        path,
        status: res.status,
        requestBody,
        responseBody: err,
      });
    }
    throw new Error(formatApiError(err.detail, res.statusText || 'Request failed'));
  }
  storeCsrfFromResponse(res);
  if (res.status === 204) return undefined as T;
  const data = (await res.json()) as T;
  if (logHttp && projectId) {
    taskLog.recordHttpStep({
      projectId,
      method,
      path,
      status: res.status,
      requestBody,
      responseBody: data,
    });
    if (
      res.status === 202 &&
      data &&
      typeof data === 'object' &&
      'job_id' in data &&
      typeof (data as { job_id: unknown }).job_id === 'string'
    ) {
      const envelope = data as { job_id: string; job_type?: string; status?: string };
      taskLog.registerJob({
        projectId,
        jobId: envelope.job_id,
        jobType: envelope.job_type ?? 'unknown',
        status: envelope.status,
        payload: requestBody as Record<string, unknown> | undefined,
      });
    } else if (res.status >= 200 && res.status < 300 && !isMultiStepHttpFlowActive()) {
      taskLog.finalizeHttpFlowForPath(projectId, path, 'completed');
    }
  }
  return data;
}

export async function requestBlob(path: string, options: RequestOptions = {}): Promise<Blob> {
  const { redirectOn401 = true, timeoutMs, _retry = false, ...fetchOptions } = options;
  const method = (fetchOptions.method ?? 'GET').toUpperCase();
  await ensureMutatingSessionHeaders(path, method);
  const headers: Record<string, string> = {
    ...(fetchOptions.headers as Record<string, string>),
  };
  if (MUTATING_METHODS.has(method)) {
    const csrf = getCsrfToken();
    if (csrf) headers['X-CSRF-Token'] = csrf;
  }
  const accessToken = getAccessToken();
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (!(fetchOptions.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs ?? REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...fetchOptions,
      headers,
      credentials: 'include',
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
  if (res.status === 401 && !_retry && redirectOn401) {
    const refreshed = await tryRefreshSession();
    if (refreshed) return requestBlob(path, { ...options, _retry: true });
  }
  if (res.status === 403) {
    const err = await res.json().catch(() => ({ detail: null }));
    if (!_retry && isCsrfErrorDetail(err.detail) && (await tryRefreshSession())) {
      return requestBlob(path, { ...options, _retry: true });
    }
    throw new Error(formatApiError(err.detail, 'Недостаточно прав для этого действия'));
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(formatApiError(err.detail, res.statusText || 'Request failed'));
  }
  return res.blob();
}

export function applyAuthSession(session: AuthSession): AuthUser {
  persistAuthTokens(session);
  const { access_token: _a, refresh_token: _r, token_type: _t, ...user } = session;
  return user;
}

export function isNotFoundApiError(err: unknown): boolean {
  return err instanceof Error && /\bnot found\b/i.test(err.message);
}
