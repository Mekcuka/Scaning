import {
  clearAuthTokens,
  getAccessToken,
  getRefreshToken,
  persistAuthTokens,
  type AuthSessionTokens,
} from './authSession';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';
const REQUEST_TIMEOUT_MS = 12_000;
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export type AuthUser = { id: string; email: string; username: string; role: string };
export type { ApiErrorBody, ApiHealthResponse } from './api/types';
export type AuthSession = AuthUser & AuthSessionTokens & { token_type?: string };

/** GitHub Pages base path, e.g. /Scaning/ */
export function appLoginPath(): string {
  const base = import.meta.env.BASE_URL || '/';
  return `${base}login`.replace(/\/{2,}/g, '/');
}

const CSRF_STORAGE_KEY = 'csrf_token';

function storeCsrfFromResponse(res: Response): void {
  const token = res.headers.get('X-CSRF-Token');
  if (token) sessionStorage.setItem(CSRF_STORAGE_KEY, token);
}

export function clearStoredCsrf(): void {
  sessionStorage.removeItem(CSRF_STORAGE_KEY);
}

function clearClientAuth(): void {
  clearStoredCsrf();
  clearAuthTokens();
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

function getCsrfToken(): string | null {
  const stored = sessionStorage.getItem(CSRF_STORAGE_KEY);
  if (stored) return stored;
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

let refreshInFlight: Promise<boolean> | null = null;

async function tryRefreshSession(): Promise<boolean> {
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

type RequestOptions = RequestInit & {
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
};

function formatApiError(detail: unknown, fallback: string): string {
  if (typeof detail === 'string') {
    if (detail === 'Insufficient permissions') return fallback;
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
        const msg = String((item as { msg: string }).msg);
        return field ? `${field}: ${msg}` : msg;
      }
      return JSON.stringify(item);
    });
    return parts.join('; ') || fallback;
  }
  if (detail && typeof detail === 'object') return JSON.stringify(detail);
  return fallback;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { redirectOn401 = true, timeoutMs, _retry = false, allowNotFound = false, ...fetchOptions } = options;
  const headers: Record<string, string> = {
    ...(fetchOptions.headers as Record<string, string>),
  };
  const isForm = fetchOptions.body instanceof FormData;
  if (!isForm) {
    headers['Content-Type'] = 'application/json';
  }
  const method = (fetchOptions.method ?? 'GET').toUpperCase();
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
      throw new Error('Сервер не отвечает. Запустите API (backend) и базу данных.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  if (res.status === 401) {
    if (!_retry && redirectOn401 && !path.startsWith('/auth/')) {
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
    throw new Error(formatApiError(err.detail, 'Недостаточно прав для этого действия'));
  }
  if (res.status === 404 && allowNotFound) {
    return null as T;
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(formatApiError(err.detail, res.statusText || 'Request failed'));
  }
  storeCsrfFromResponse(res);
  if (res.status === 204) return undefined as T;
  return res.json();
}

async function requestBlob(path: string, options: RequestOptions = {}): Promise<Blob> {
  const { redirectOn401 = true, timeoutMs, _retry = false, ...fetchOptions } = options;
  const headers: Record<string, string> = {
    ...(fetchOptions.headers as Record<string, string>),
  };
  const method = (fetchOptions.method ?? 'GET').toUpperCase();
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
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(formatApiError(err.detail, res.statusText || 'Request failed'));
  }
  return res.blob();
}

function applyAuthSession(session: AuthSession): AuthUser {
  persistAuthTokens(session);
  const { access_token: _a, refresh_token: _r, token_type: _t, ...user } = session;
  return user;
}

export const api = {
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
  adminUsers: async () => {
    const rows = await request<
      Array<{
        id: string;
        email: string;
        username: string;
        role: string;
        is_active: boolean;
        created_at: string;
        project_count?: number;
      }>
    >('/admin/users');
    return rows.map((row) => ({
      ...row,
      project_count: typeof row.project_count === 'number' ? row.project_count : 0,
    }));
  },
  updateAdminUser: (id: string, data: { role?: string; is_active?: boolean }) =>
    request(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  adminStats: () => request<{ users: number; projects: number; pois: number }>('/admin/stats'),
  projects: () => request<Project[]>('/projects'),
  createProject: (name: string, description?: string) =>
    request<Project>('/projects', { method: 'POST', body: JSON.stringify({ name, description }) }),
  getProject: (id: string) => request<Project>(`/projects/${id}`),
  updateProject: (
    id: string,
    data: Partial<Pick<Project, 'name' | 'description' | 'status' | 'visibility'>>
  ) => request<Project>(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteProject: (id: string) => request<void>(`/projects/${id}`, { method: 'DELETE' }),
  getRates: (projectId: string) => request<{ project_id: string; rates: Record<string, number> }>(`/projects/${projectId}/rates`),
  updateRates: (projectId: string, rates: Record<string, number>) =>
    request(`/projects/${projectId}/rates`, { method: 'PUT', body: JSON.stringify({ rates }) }),
  getPois: (projectId: string) => request<POI[]>(`/projects/${projectId}/pois`),
  createPoi: (
    projectId: string,
    data: Partial<POI> & { lon: number; lat: number; name: string },
    opts?: { timeoutMs?: number },
  ) =>
    request<POI>(`/projects/${projectId}/pois`, {
      method: 'POST',
      body: JSON.stringify(data),
      timeoutMs: opts?.timeoutMs,
    }),
  updatePoi: (projectId: string, poiId: string, data: Partial<POI> & { lon?: number; lat?: number }) =>
    request<POI>(`/projects/${projectId}/pois/${poiId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deletePoi: (projectId: string, poiId: string) =>
    request<void>(`/projects/${projectId}/pois/${poiId}`, { method: 'DELETE' }),
  analyzePoi: (projectId: string, poiId: string) =>
    request<AnalysisResult>(`/projects/${projectId}/pois/${poiId}/analyze`, { method: 'POST' }),
  analyzeAllPois: (projectId: string) =>
    request<ProjectAnalysisBatchResult>(`/projects/${projectId}/pois/analyze-all`, {
      method: 'POST',
    }),
  getPoiAnalysis: (projectId: string, poiId: string) =>
    request<PoiAnalysisResponse>(`/projects/${projectId}/pois/${poiId}/analysis`),
  getCandidates: (
    projectId: string,
    poiId: string,
    subtype: string,
    limit = 20,
    paramType?: 'external' | 'external_linear'
  ) => {
    const qs = new URLSearchParams({
      subtype,
      limit: String(limit),
    });
    if (paramType) qs.set('param_type', paramType);
    return request<Candidate[]>(`/projects/${projectId}/pois/${poiId}/candidates?${qs}`);
  },
  overrideAnalysis: (
    projectId: string,
    poiId: string,
    subtype: string,
    body: {
      nearest_object_id?: string;
      nearest_node_id?: string;
      force_construction?: boolean;
      param_type?: 'external' | 'external_linear';
    }
  ) =>
    request<PoiAnalysisResponse>(`/projects/${projectId}/pois/${poiId}/analysis/${subtype}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  previewImport: (projectId: string, file: File, format: string) => {
    const fd = new FormData();
    fd.append('file', file);
    return request<{ rows: Record<string, unknown>[]; errors: string[]; records_total: number }>(
      `/projects/${projectId}/import/preview?format=${format}`,
      { method: 'POST', body: fd }
    );
  },
  importGeojsonAsync: (projectId: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return request<ImportLog>(`/projects/${projectId}/import/geojson/async`, { method: 'POST', body: fd });
  },
  importKmlAsync: (projectId: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return request<ImportLog>(`/projects/${projectId}/import/kml/async`, { method: 'POST', body: fd });
  },
  getDistanceDefaults: (projectId: string) =>
    request<DistanceDefaults>(`/projects/${projectId}/distance-defaults`),
  updateDistanceDefaults: (projectId: string, data: Partial<DistanceDefaults>) =>
    request<DistanceDefaults>(`/projects/${projectId}/distance-defaults`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteLayer: (projectId: string, layerId: string) =>
    request<void>(`/projects/${projectId}/infrastructure/layers/${layerId}`, { method: 'DELETE' }),
  getLayers: (projectId: string) => request<InfraLayer[]>(`/projects/${projectId}/infrastructure/layers`),
  createLayer: (projectId: string, data: Partial<InfraLayer> & { name: string }) =>
    request<InfraLayer>(`/projects/${projectId}/infrastructure/layers`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateLayer: (projectId: string, layerId: string, data: Partial<InfraLayer>) =>
    request<InfraLayer>(`/projects/${projectId}/infrastructure/layers/${layerId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  getInfraObjects: (projectId: string, params?: { subtype?: string; q?: string; bbox?: string; visibleLayersOnly?: boolean }) => {
    const qs = new URLSearchParams();
    if (params?.subtype) qs.set('subtype', params.subtype);
    if (params?.q) qs.set('q', params.q);
    if (params?.bbox) qs.set('bbox', params.bbox);
    if (params?.visibleLayersOnly === true) qs.set('visible_layers_only', 'true');
    else qs.set('visible_layers_only', 'false');
    const query = qs.toString();
    return request<InfraObject[]>(
      `/projects/${projectId}/infrastructure/objects${query ? `?${query}` : ''}`
    );
  },
  listMap3dCustomModels: (projectId: string) =>
    request<Map3dCustomModel[]>(`/projects/${projectId}/map3d-custom-models`),
  uploadMap3dCustomModel: (projectId: string, file: File, targetHeightM?: number) => {
    const fd = new FormData();
    fd.append('file', file);
    if (targetHeightM != null) fd.append('target_height_m', String(targetHeightM));
    return request<Map3dCustomModel>(`/projects/${projectId}/map3d-custom-models`, {
      method: 'POST',
      body: fd,
    });
  },
  deleteMap3dCustomModel: (projectId: string, modelId: string) =>
    request<void>(`/projects/${projectId}/map3d-custom-models/${modelId}`, { method: 'DELETE' }),
  assignMap3dCustomModel: (projectId: string, modelId: string, subtypes: string[]) =>
    request<Map3dCustomModel>(`/projects/${projectId}/map3d-custom-models/${modelId}/assign`, {
      method: 'POST',
      body: JSON.stringify({ subtypes }),
    }),
  createInfraObject: (
    projectId: string,
    data: InfraObjectCreate,
    opts?: { timeoutMs?: number },
  ) =>
    request<InfraObject>(`/projects/${projectId}/infrastructure/objects`, {
      method: 'POST',
      body: JSON.stringify(data),
      timeoutMs: opts?.timeoutMs,
    }),
  /** НПЗ (refinery), НПС (oil_pumping_station) — subtype в теле обязателен. */
  createFacilityInfraObject: (projectId: string, data: FacilityInfraObjectCreate) =>
    request<InfraObject>(`/projects/${projectId}/infrastructure/facility-objects`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateInfraObject: (projectId: string, objectId: string, data: Partial<InfraObjectCreate>) =>
    request<InfraObject>(`/projects/${projectId}/infrastructure/objects/${objectId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  clearProjectInfrastructure: (projectId: string) =>
    request<{ deleted_objects: number; deleted_edges: number; deleted_nodes: number }>(
      `/projects/${projectId}/infrastructure/clear`,
      { method: 'POST' }
    ),
  deleteInfraObject: (projectId: string, objectId: string) =>
    request<void>(`/projects/${projectId}/infrastructure/objects/${objectId}`, { method: 'DELETE' }),
  importCsv: (projectId: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return request<ImportLog>(`/projects/${projectId}/import/csv`, { method: 'POST', body: fd });
  },
  importGeojson: (projectId: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return request<ImportLog>(`/projects/${projectId}/import/geojson`, { method: 'POST', body: fd });
  },
  importSpark: (projectId: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return request<ImportLog>(`/projects/${projectId}/import/spark`, { method: 'POST', body: fd });
  },
  importSparkAsync: (projectId: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return request<ImportLog>(`/projects/${projectId}/import/spark/async`, { method: 'POST', body: fd });
  },
  importKml: (projectId: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return request<ImportLog>(`/projects/${projectId}/import/kml`, { method: 'POST', body: fd });
  },
  importShapefile: (projectId: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return request<ImportLog>(`/projects/${projectId}/import/shapefile`, { method: 'POST', body: fd });
  },
  importCsvAsync: (projectId: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return request<ImportLog>(`/projects/${projectId}/import/csv/async`, { method: 'POST', body: fd });
  },
  getImportLog: (logId: string) => request<ImportLog>(`/import/logs/${logId}`),
  getImportLogs: (projectId?: string) =>
    request<ImportLog[]>(`/import/logs${projectId ? `?project_id=${projectId}` : ''}`),
  getImportConnections: (projectId: string) =>
    request<ImportConnection[]>(`/projects/${projectId}/import_connections`),
  createImportConnection: (projectId: string, data: ImportConnectionCreate) =>
    request<ImportConnection>(`/projects/${projectId}/import_connections`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateImportConnection: (projectId: string, id: string, data: Partial<ImportConnectionCreate>) =>
    request<ImportConnection>(`/projects/${projectId}/import_connections/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteImportConnection: (projectId: string, id: string) =>
    request<void>(`/projects/${projectId}/import_connections/${id}`, { method: 'DELETE' }),
  testImportConnection: (projectId: string, id: string) =>
    request<{ ok: boolean; status_code?: number; error?: string }>(
      `/projects/${projectId}/import_connections/${id}/test`,
      { method: 'POST' }
    ),
  syncImportConnection: (projectId: string, id: string) =>
    request<{ imported: number }>(`/projects/${projectId}/import/sync/${id}`, { method: 'POST' }),
  buildNetwork: (projectId: string) =>
    request<InfrastructureNetwork>(`/projects/${projectId}/infrastructure/networks/build`, {
      method: 'POST',
    }),
  getNetworks: (projectId: string) =>
    request<InfrastructureNetwork[]>(`/projects/${projectId}/infrastructure/networks`),
  getNetworkNodes: (projectId: string, networkId: string) =>
    request<NetworkNode[]>(`/projects/${projectId}/infrastructure/networks/${networkId}/nodes`),
  getNetworkEdges: (projectId: string, networkId: string) =>
    request<NetworkEdge[]>(`/projects/${projectId}/infrastructure/networks/${networkId}/edges`),
  analyzeSandLogistics: (projectId: string) =>
    request<SandLogisticsResult>(`/projects/${projectId}/sand-logistics/analyze`, {
      method: 'POST',
    }),
  getFlowSchematic: (projectId: string, poiId: string) =>
    request<import('./flowSchematic').FlowSchematicDto>(
      `/projects/${projectId}/pois/${poiId}/flow-schematic`
    ),
  saveFlowSchematic: (
    projectId: string,
    poiId: string,
    body: { nodes: import('./flowSchematic').FlowSchematicNodeDto[]; edges: import('./flowSchematic').FlowSchematicEdgeDto[] }
  ) =>
    request<import('./flowSchematic').FlowSchematicDto>(
      `/projects/${projectId}/pois/${poiId}/flow-schematic`,
      { method: 'PUT', body: JSON.stringify(body) }
    ),
  resetFlowSchematic: (projectId: string, poiId: string) =>
    request<import('./flowSchematic').FlowSchematicDto>(
      `/projects/${projectId}/pois/${poiId}/flow-schematic`,
      { method: 'DELETE' }
    ),
  getEconomicFlowSchematic: (projectId: string, poiId: string) =>
    request<import('./economicFlowSchematic').EconomicFlowSchematicDto>(
      `/projects/${projectId}/pois/${poiId}/economic-flow-schematic`
    ),
  getEconomicParams: (projectId: string) =>
    request<import('./economicFlowSchematic').EconomicParamsDto>(
      `/projects/${projectId}/economic-params`
    ),
  updateEconomicParams: (projectId: string, params: Record<string, number>) =>
    request<import('./economicFlowSchematic').EconomicParamsDto>(
      `/projects/${projectId}/economic-params`,
      { method: 'PUT', body: JSON.stringify({ params }) }
    ),
  getOnePagers: (projectId: string) => request<OnePager[]>(`/projects/${projectId}/one-pagers`),
  getOnePager: (projectId: string, id: string) =>
    request<OnePager>(`/projects/${projectId}/one-pagers/${id}`),
  createOnePager: (projectId: string, body: OnePagerCreatePayload) =>
    request<OnePager>(`/projects/${projectId}/one-pagers`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateOnePager: (projectId: string, id: string, body: OnePagerUpdatePayload) =>
    request<OnePager>(`/projects/${projectId}/one-pagers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  deleteOnePager: (projectId: string, id: string) =>
    request<void>(`/projects/${projectId}/one-pagers/${id}`, { method: 'DELETE' }),
  exportOnePagerPptx: (projectId: string, id: string, mapSnapshotBase64?: string | null) =>
    requestBlob(`/projects/${projectId}/one-pagers/${id}/export/pptx`, {
      method: 'POST',
      body: JSON.stringify({ map_snapshot_base64: mapSnapshotBase64 ?? null }),
    }),
};

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
  visibility: string;
  poi_count: number;
  owner_user_id: string;
  owner_name: string;
  created_at: string;
  updated_at: string;
}

export interface POI {
  id: string;
  project_id: string;
  name: string;
  description?: string | null;
  lon: number;
  lat: number;
  planned_production_volume: number;
  production_per_well: number;
  wells_per_pad: number;
  fluid_type: string;
  water_injection_volume: number;
  gas_factor: number;
  eng_power: string;
  eng_injection: string;
  eng_gas: string;
  eng_oil_preparation: string;
  eng_well_gathering: string;
  eng_transport: string;
  pads_count: number;
  wells_total: number;
  threshold_gas_processing_km?: number | null;
  threshold_gtes_km?: number | null;
  threshold_substation_km?: number | null;
  threshold_refinery_km?: number | null;
  max_total_line_autoroad_km?: number | null;
  max_total_line_oil_pipeline_km?: number | null;
  max_total_line_gas_pipeline_km?: number | null;
  max_total_line_water_pipeline_km?: number | null;
  max_total_line_power_line_km?: number | null;
  km_per_pad_autoroad?: number | null;
  km_per_pad_oil_pipeline?: number | null;
  km_per_pad_gas_pipeline?: number | null;
  km_per_pad_water_pipeline?: number | null;
  km_per_pad_power_line?: number | null;
}

export interface DistanceDefaults {
  threshold_gas_processing_km: number;
  threshold_gtes_km: number;
  threshold_substation_km: number;
  threshold_refinery_km: number;
  threshold_ground_pumping_station_km: number;
  threshold_sand_quarry_km: number;
  max_total_line_autoroad_km: number;
  max_total_line_oil_pipeline_km: number;
  max_total_line_gas_pipeline_km: number;
  max_total_line_water_pipeline_km: number;
  max_total_line_power_line_km: number;
  max_total_line_methanol_pipeline_km: number;
  max_total_line_additional_line_km: number;
  km_per_pad_autoroad: number;
  km_per_pad_oil_pipeline: number;
  km_per_pad_gas_pipeline: number;
  km_per_pad_water_pipeline: number;
  km_per_pad_power_line: number;
}

export interface InfraLayer {
  id: string;
  project_id: string;
  name: string;
  layer_type: string;
  source_type: string;
  is_visible: boolean;
  opacity: number;
  sort_order: number;
  style_config: Record<string, unknown>;
}

export interface Map3dCustomModel {
  id: string;
  project_id: string;
  filename: string;
  target_height_m: number;
  created_at: string;
  assigned_subtypes: string[];
}

export interface InfraObject {
  id: string;
  layer_id: string;
  name: string;
  subtype: string;
  category: string;
  lon: number;
  lat: number;
  end_lon?: number | null;
  end_lat?: number | null;
  coordinates?: number[][] | null;
  properties?: Record<string, unknown>;
  render_3d_effective?: { height_m: number; base_m: number; visible: boolean; scale: number };
}

export interface InfraObjectCreate {
  name: string;
  /** Код подтипа (обязательно). */
  subtype: string;
  lon: number;
  lat: number;
  end_lon?: number;
  end_lat?: number;
  coordinates?: number[][];
  layer_id?: string;
  description?: string;
  properties?: Record<string, unknown>;
}

/** НПЗ / НПС — subtype обязателен и только из этого списка. */
export type FacilityPointSubtype = 'refinery' | 'oil_pumping_station';

export interface FacilityInfraObjectCreate {
  name: string;
  subtype: FacilityPointSubtype;
  lon: number;
  lat: number;
  layer_id?: string;
  description?: string;
  properties?: Record<string, unknown>;
}

export interface AnalysisRow {
  subtype: string;
  param_type: string;
  status: string;
  distance_km?: number | null;
  limit_km?: number | null;
  distance_source?: string;
  nearest_object_id?: string | null;
  nearest_node_id?: string | null;
  object_name?: string | null;
  anchor_lon?: number | null;
  anchor_lat?: number | null;
  anchor_type?: string | null;
  is_manually_overridden?: boolean;
  force_construction?: boolean;
  cost_mln?: number | null;
  km_per_pad?: number | null;
  pads_count?: number | null;
  formula_label?: string | null;
  wells_total?: number | null;
}

export interface PoiAnalysisResponse {
  poi_id: string;
  total_cost_mln: number;
  overall_status: string;
  rows: AnalysisRow[];
  analysis?: AnalysisRow[];
  engineering_status?: Record<string, string>;
}

export interface AnalysisResult {
  poi_id: string;
  total_cost_mln: number;
  overall_status: string;
  analysis: Array<Record<string, unknown>>;
  rows?: AnalysisRow[];
  engineering_status: Record<string, string>;
}

export interface ProjectAnalysisBatchResult {
  project_id: string;
  analyzed_count: number;
  results: AnalysisResult[];
}

const EXTERNAL_SUBTYPES = new Set([
  'gas_processing',
  'gtes',
  'substation',
  'refinery',
  'ground_pumping_station',
]);

function roundKm(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 10) / 10;
}

function mapRawToAnalysisRow(r: Record<string, unknown>): AnalysisRow {
  const subtype = String(r.subtype ?? '');
  const defaultParamType = EXTERNAL_SUBTYPES.has(subtype)
    ? 'external'
    : subtype === 'pads'
      ? 'internal'
      : 'internal';
  const nearestId =
    (r.nearest_object_id as string | null | undefined) ??
    (r.object_id as string | null | undefined) ??
    null;
  return {
    subtype,
    param_type: String(r.param_type ?? defaultParamType),
    status: String(r.status ?? ''),
    distance_km: roundKm(r.distance_km),
    limit_km: roundKm(r.limit_km),
    distance_source: r.distance_source as string | undefined,
    nearest_object_id: nearestId,
    nearest_node_id: (r.nearest_node_id as string | null) ?? null,
    object_name: (r.object_name as string | null) ?? null,
    anchor_lon: (r.anchor_lon as number | null) ?? null,
    anchor_lat: (r.anchor_lat as number | null) ?? null,
    anchor_type: (r.anchor_type as string | null) ?? null,
    is_manually_overridden: Boolean(r.is_manually_overridden),
    force_construction: Boolean(r.force_construction),
    cost_mln: (r.cost_mln as number | null | undefined) ?? null,
    km_per_pad: (r.km_per_pad as number | null) ?? null,
    pads_count: (r.pads_count as number | null) ?? null,
    formula_label: (r.formula_label as string | null) ?? null,
    wells_total: (r.wells_total as number | null) ?? null,
  };
}

/** Normalize POST /analyze or GET /analysis payload for the UI. */
export function normalizePoiAnalysisResponse(
  data: AnalysisResult | PoiAnalysisResponse
): PoiAnalysisResponse {
  const rawRows = data.rows ?? data.analysis ?? [];
  const rows = rawRows.map((r) =>
    mapRawToAnalysisRow(r as Record<string, unknown>)
  );
  return {
    poi_id: data.poi_id,
    total_cost_mln: data.total_cost_mln,
    overall_status: data.overall_status,
    rows,
    analysis: rows,
    engineering_status: data.engineering_status,
  };
}

export interface Candidate {
  object_id: string | null;
  nearest_node_id?: string | null;
  name: string;
  distance_km: number;
  anchor_lon: number;
  anchor_lat: number;
  anchor_type?: string | null;
}

export interface ImportConnectionCreate {
  name: string;
  api_url: string;
  auth_type?: string;
  credentials?: string;
  registry_type?: string | null;
}

export interface ImportConnection {
  id: string;
  project_id: string;
  name: string;
  api_url: string;
  auth_type: string;
  registry_type?: string | null;
  created_at: string;
}

export interface InfrastructureNetwork {
  id: string;
  project_id: string;
  name: string;
}

export interface NetworkNode {
  id: string;
  network_id: string;
  infrastructure_object_id: string | null;
  lon: number;
  lat: number;
}

export interface NetworkEdge {
  id: string;
  network_id: string;
  from_node_id: string;
  to_node_id: string;
  length_km: number;
}

export interface SandLogisticsNetworkNode {
  id: string;
  lon: number;
  lat: number;
}

export interface SandLogisticsNetworkEdge {
  id: string;
  from_node_id: string;
  to_node_id: string;
  length_km: number;
}

export interface SandLogisticsProportionalPart {
  quarry_id: string;
  quarry_name: string;
  allocated_m3: number;
  distance_km: number | null;
}

export interface SandLogisticsQuarryRow {
  object_id: string;
  name: string;
  lon: number;
  lat: number;
  snap_node_id?: string | null;
  entry_date: string;
  in_service: boolean;
  initial_m3: number;
  current_m3: number;
  greedy_allocated_m3: number;
  greedy_remaining_m3: number;
  proportional_allocated_m3: number;
  proportional_exceeds_capacity: boolean;
}

export interface SandLogisticsConsumerRow {
  object_id: string;
  name: string;
  subtype: string;
  lon: number;
  lat: number;
  snap_node_id?: string | null;
  demand_m3: number;
  entry_date: string;
  in_service: boolean;
  nearest_quarry_id: string | null;
  nearest_quarry_name: string | null;
  distance_km: number | null;
  snap_to_node_km: number | null;
  distances_to_quarries_km?: Record<string, number | null>;
  greedy_quarry_id: string | null;
  greedy_quarry_name: string | null;
  greedy_allocated_m3: number;
  proportional_allocations: SandLogisticsProportionalPart[];
}

export interface SandLogisticsSubnet {
  subnet_index: number;
  name: string;
  autoroad_edge_count: number;
  quarry_count: number;
  consumer_count: number;
  network_nodes: SandLogisticsNetworkNode[];
  network_edges: SandLogisticsNetworkEdge[];
  quarries: SandLogisticsQuarryRow[];
  consumers: SandLogisticsConsumerRow[];
  warnings: string[];
}

export interface SandLogisticsResult {
  project_id: string;
  as_of: string;
  network_id: string;
  subnet_count: number;
  subnets: SandLogisticsSubnet[];
  warnings: string[];
  /** Имена всех карьеров/потребителей (в т.ч. вне подсетей) для подписей предупреждений */
  object_names: Record<string, string>;
}

export interface ImportLog {
  id: string;
  project_id?: string | null;
  source_type: string;
  file_name: string | null;
  status: string;
  records_total: number;
  records_imported: number;
  errors: string[];
  created_at: string;
}

export interface OnePagerRoadmapStage {
  stage: string;
  duration_months: number | null;
}

export interface OnePager {
  id: string;
  project_id: string;
  poi_id: string;
  title: string;
  coordinates: string | null;
  engineer_name: string | null;
  report_date: string | null;
  final_variant_data: Record<string, unknown>;
  engineering_params: Record<string, unknown>;
  roadmap: OnePagerRoadmapStage[];
  recommendation_text: string | null;
  is_recommendation_edited: boolean;
  generation_status: string;
  poi_name: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface OnePagerCreatePayload {
  poi_id: string;
  engineer_name?: string | null;
  roadmap?: OnePagerRoadmapStage[] | null;
  recommendation_text?: string | null;
  map_snapshot_base64?: string | null;
}

export interface OnePagerUpdatePayload {
  recommendation_text?: string | null;
  roadmap?: OnePagerRoadmapStage[] | null;
  map_snapshot_base64?: string | null;
  engineer_name?: string | null;
}

export const POINT_SUBTYPES = [
  'gas_processing',
  'ukg',
  'tsg',
  'gtes',
  'gpes',
  'vies',
  'substation',
  'refinery',
  'node',
  'pad',
  'preliminary_water_discharge_station',
  'booster_pumping_station',
  'oil_pumping_station',
  'ground_pumping_station',
  'sand_quarry',
  'methanol_facility',
  'methanol_joint',
  'offplot',
  'additional_facility',
] as const;

/** Map/import layer filter (includes gas_pipeline). */
export const LINE_SUBTYPES = [
  'autoroad',
  'oil_pipeline',
  'gas_pipeline',
  'water_pipeline',
  'power_line',
  'methanol_pipeline',
  'additional_line',
] as const;

export const ALL_MAP_SUBTYPES = [...POINT_SUBTYPES, ...LINE_SUBTYPES] as const;

/** FR-6: 4 internal linear subtypes in environment analysis. */
export const ANALYSIS_LINE_SUBTYPES = ['autoroad', 'oil_pipeline', 'water_pipeline', 'power_line'] as const;
/** Nearest vertex/node on map for all drawable line subtypes. */
export const EXTERNAL_LINEAR_SUBTYPES = LINE_SUBTYPES;

export const SUBTYPE_LABELS: Record<string, string> = {
  autoroad: 'Автодорога',
  oil_pipeline: 'Нефтепровод',
  gas_pipeline: 'Газопровод',
  water_pipeline: 'Водопровод',
  power_line: 'ЛЭП',
  methanol_pipeline: 'Метанолопровод',
  gas_processing: 'ГКС',
  ukg: 'УКГ',
  tsg: 'ТСГ',
  gtes: 'ГТЭС',
  gpes: 'ГПЭС',
  vies: 'ВИЭС',
  substation: 'ПС/ТП',
  refinery: 'НПЗ',
  node: 'Узел',
  pad: 'Куст',
  preliminary_water_discharge_station: 'УПСВ',
  booster_pumping_station: 'ДНС',
  oil_pumping_station: 'НПС',
  ground_pumping_station: 'БКНС',
  sand_quarry: 'Карьер песка',
  methanol_facility: 'Объект метанола',
  methanol_joint: 'Узел метанола',
  additional_line: 'Доп. линия',
  additional_facility: 'Доп. объект',
  offplot: 'ВО',
};

export function createDefaultSubtypeFilter(): Record<string, boolean> {
  return Object.fromEntries(ALL_MAP_SUBTYPES.map((s) => [s, true]));
}

/** ГКС + УКГ + ТСГ — смена подтипа только внутри этой группы. */
export const GKS_CLUSTER_SUBTYPES = ['gas_processing', 'ukg', 'tsg'] as const;

/** Узел + узел метанола — смена подтипа только внутри этой пары. */
export const NODE_CLUSTER_SUBTYPES = ['node', 'methanol_joint'] as const;

/** Подпись в меню «Точка» (если отличается от SUBTYPE_LABELS). */
export const POINT_MENU_LABELS: Partial<Record<string, string>> = {
  gtes: 'ИЭ',
};

export function pointMenuLabel(subtype: string): string {
  return POINT_MENU_LABELS[subtype] ?? SUBTYPE_LABELS[subtype] ?? subtype;
}

/** ГТЭС + ГПЭС + ВИЭС — смена подтипа только внутри группы. */
export const GTES_CLUSTER_SUBTYPES = ['gtes', 'gpes', 'vies'] as const;

/** Sidebar «Слои данных» — each map subtype belongs to exactly one group. */
export const LAYER_VISIBILITY_GROUPS: { id: string; label: string; subtypes: readonly string[] }[] = [
  { id: 'roads', label: 'Дороги', subtypes: ['autoroad'] },
  {
    id: 'pipelines',
    label: 'Трубопроводы',
    subtypes: LINE_SUBTYPES.filter((s) => s !== 'autoroad' && s !== 'additional_line'),
  },
  { id: 'gks', label: 'ГКС / УКГ / ТСГ', subtypes: GKS_CLUSTER_SUBTYPES },
  { id: 'gtes', label: 'ИЭ', subtypes: GTES_CLUSTER_SUBTYPES },
  {
    id: 'energy',
    label: 'Подстанции',
    subtypes: ['substation'],
  },
  {
    id: 'industrial',
    label: 'НПЗ / насосные',
    subtypes: [
      'refinery',
      'oil_pumping_station',
      'preliminary_water_discharge_station',
      'booster_pumping_station',
      'ground_pumping_station',
    ],
  },
  { id: 'pads_quarry', label: 'Кусты и карьер', subtypes: ['pad', 'sand_quarry'] },
  { id: 'offplot', label: 'ВО', subtypes: ['offplot'] },
  { id: 'additional_facility', label: 'Доп. объекты', subtypes: ['additional_facility'] },
  { id: 'additional_linear', label: 'Доп. линии', subtypes: ['additional_line'] },
  { id: 'methanol_facility', label: 'Объект метанола', subtypes: ['methanol_facility'] },
  { id: 'nodes', label: 'Узлы', subtypes: NODE_CLUSTER_SUBTYPES },
];

const GKS_CLUSTER_SET = new Set<string>(GKS_CLUSTER_SUBTYPES);
const NODE_CLUSTER_SET = new Set<string>(NODE_CLUSTER_SUBTYPES);
const GTES_CLUSTER_SET = new Set<string>(GTES_CLUSTER_SUBTYPES);

export function isGksClusterSubtype(subtype: string): boolean {
  return GKS_CLUSTER_SET.has(subtype);
}

export function isNodeClusterSubtype(subtype: string): boolean {
  return NODE_CLUSTER_SET.has(subtype);
}

export function isGtesClusterSubtype(subtype: string): boolean {
  return GTES_CLUSTER_SET.has(subtype);
}

/** Point subtypes that cannot be changed after the object is created. */
export const IMMUTABLE_POINT_SUBTYPES = [
  'sand_quarry',
  'ground_pumping_station',
  'oil_pumping_station',
  'methanol_facility',
  'offplot',
  'additional_facility',
] as const;

/** Искра/import only — not in map «Точка» menu or general POST /objects. */
export const IMPORT_ONLY_POINT_SUBTYPES = [
  'ukg',
  'tsg',
  'gpes',
  'vies',
  'oil_pumping_station',
  'methanol_facility',
  'methanol_joint',
] as const;

const IMPORT_ONLY_POINT_SET = new Set<string>(IMPORT_ONLY_POINT_SUBTYPES);

/** Нельзя выбрать в карточке другого объекта (кроме самого подтипа). */
export const EXCLUSIVE_POINT_SUBTYPES = ['sand_quarry', 'methanol_facility', 'offplot', 'additional_facility'] as const;

const EXCLUSIVE_POINT_SET = new Set<string>(EXCLUSIVE_POINT_SUBTYPES);

export const MAP_DRAWABLE_POINT_SUBTYPES = POINT_SUBTYPES.filter(
  (s) => !IMPORT_ONLY_POINT_SET.has(s),
);

export function isImmutablePointSubtype(subtype: string): boolean {
  return (IMMUTABLE_POINT_SUBTYPES as readonly string[]).includes(subtype);
}

/** Subtype options for ObjectDetailPanel / edits (respects line vs point and immutable subtypes). */
export function infraSubtypeSelectOptions(object: InfraObject): { value: string; label: string }[] {
  if (isImmutablePointSubtype(object.subtype)) {
    return [{ value: object.subtype, label: SUBTYPE_LABELS[object.subtype] || object.subtype }];
  }
  if (isGksClusterSubtype(object.subtype)) {
    return GKS_CLUSTER_SUBTYPES.map((value) => ({
      value,
      label: SUBTYPE_LABELS[value] || value,
    }));
  }
  if (isNodeClusterSubtype(object.subtype)) {
    return NODE_CLUSTER_SUBTYPES.map((value) => ({
      value,
      label: SUBTYPE_LABELS[value] || value,
    }));
  }
  if (isGtesClusterSubtype(object.subtype)) {
    return GTES_CLUSTER_SUBTYPES.map((value) => ({
      value,
      label: SUBTYPE_LABELS[value] || value,
    }));
  }
  const isLine =
    (LINE_SUBTYPES as readonly string[]).includes(object.subtype) ||
    (object.coordinates != null && object.coordinates.length >= 2) ||
    (object.end_lon != null && object.end_lat != null);
  const keys = isLine
    ? LINE_SUBTYPES
    : POINT_SUBTYPES.filter(
        (s) =>
          !IMPORT_ONLY_POINT_SET.has(s) &&
          !EXCLUSIVE_POINT_SET.has(s) &&
          !GTES_CLUSTER_SET.has(s) &&
          !NODE_CLUSTER_SET.has(s),
      );
  return keys.map((value) => ({ value, label: SUBTYPE_LABELS[value] || value }));
}
