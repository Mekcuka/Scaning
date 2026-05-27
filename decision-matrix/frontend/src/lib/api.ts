const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';
const REQUEST_TIMEOUT_MS = 12_000;

function getToken(): string | null {
  return localStorage.getItem('access_token');
}

type RequestOptions = RequestInit & { redirectOn401?: boolean };

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { redirectOn401 = true, ...fetchOptions } = options;
  const headers: Record<string, string> = {
    ...(fetchOptions.headers as Record<string, string>),
  };
  const isForm = fetchOptions.body instanceof FormData;
  if (!isForm) {
    headers['Content-Type'] = 'application/json';
  }
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...fetchOptions, headers, signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Сервер не отвечает. Запустите API (backend) и базу данных.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  if (res.status === 401) {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    if (redirectOn401) {
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail) || 'Request failed');
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  login: (email: string, password: string) =>
    request<{ access_token: string; refresh_token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (email: string, password: string, username: string) =>
    request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, username }),
    }),
  me: () =>
    request<{ id: string; email: string; username: string; role: string }>('/auth/me', {
      redirectOn401: false,
    }),
  projects: () => request<Project[]>('/projects'),
  createProject: (name: string, description?: string) =>
    request<Project>('/projects', { method: 'POST', body: JSON.stringify({ name, description }) }),
  getProject: (id: string) => request<Project>(`/projects/${id}`),
  deleteProject: (id: string) => request<void>(`/projects/${id}`, { method: 'DELETE' }),
  getRates: (projectId: string) => request<{ project_id: string; rates: Record<string, number> }>(`/projects/${projectId}/rates`),
  updateRates: (projectId: string, rates: Record<string, number>) =>
    request(`/projects/${projectId}/rates`, { method: 'PUT', body: JSON.stringify({ rates }) }),
  getPois: (projectId: string) => request<POI[]>(`/projects/${projectId}/pois`),
  createPoi: (projectId: string, data: Partial<POI> & { lon: number; lat: number; name: string }) =>
    request<POI>(`/projects/${projectId}/pois`, { method: 'POST', body: JSON.stringify(data) }),
  updatePoi: (projectId: string, poiId: string, data: Partial<POI> & { lon?: number; lat?: number }) =>
    request<POI>(`/projects/${projectId}/pois/${poiId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deletePoi: (projectId: string, poiId: string) =>
    request<void>(`/projects/${projectId}/pois/${poiId}`, { method: 'DELETE' }),
  analyzePoi: (projectId: string, poiId: string) =>
    request<AnalysisResult>(`/projects/${projectId}/pois/${poiId}/analyze`, { method: 'POST' }),
  getPoiAnalysis: (projectId: string, poiId: string) =>
    request<{ poi_id: string; rows: AnalysisRow[] }>(`/projects/${projectId}/pois/${poiId}/analysis`),
  getCandidates: (projectId: string, poiId: string, subtype: string, limit = 20) =>
    request<Candidate[]>(
      `/projects/${projectId}/pois/${poiId}/candidates?subtype=${encodeURIComponent(subtype)}&limit=${limit}`
    ),
  overrideAnalysis: (
    projectId: string,
    poiId: string,
    subtype: string,
    body: { nearest_object_id?: string; nearest_node_id?: string }
  ) =>
    request<AnalysisRow>(`/projects/${projectId}/pois/${poiId}/analysis/${subtype}`, {
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
  getInfraObjects: (projectId: string, params?: { subtype?: string; q?: string; bbox?: string }) => {
    const qs = new URLSearchParams();
    if (params?.subtype) qs.set('subtype', params.subtype);
    if (params?.q) qs.set('q', params.q);
    if (params?.bbox) qs.set('bbox', params.bbox);
    const query = qs.toString();
    return request<InfraObject[]>(
      `/projects/${projectId}/infrastructure/objects${query ? `?${query}` : ''}`
    );
  },
  createInfraObject: (projectId: string, data: InfraObjectCreate) =>
    request<InfraObject>(`/projects/${projectId}/infrastructure/objects`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateInfraObject: (projectId: string, objectId: string, data: Partial<InfraObjectCreate>) =>
    request<InfraObject>(`/projects/${projectId}/infrastructure/objects/${objectId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
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
  getScenarios: (projectId: string) => request<Scenario[]>(`/projects/${projectId}/scenarios`),
  calculateRanking: (data: RankingRequest) =>
    request<RankingResult>('/ranking/calculate', { method: 'POST', body: JSON.stringify(data) }),
};

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
  visibility: string;
  poi_count: number;
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
  max_total_line_autoroad_km: number;
  max_total_line_oil_pipeline_km: number;
  max_total_line_gas_pipeline_km: number;
  max_total_line_water_pipeline_km: number;
  max_total_line_power_line_km: number;
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
}

export interface InfraObjectCreate {
  name: string;
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

export interface AnalysisRow {
  subtype: string;
  param_type: string;
  status: string;
  distance_km?: number | null;
  limit_km?: number;
  distance_source?: string;
  nearest_object_id?: string | null;
  nearest_node_id?: string | null;
  object_name?: string | null;
  anchor_lon?: number | null;
  anchor_lat?: number | null;
  anchor_type?: string | null;
  is_manually_overridden?: boolean;
}

export interface AnalysisResult {
  poi_id: string;
  total_cost_mln: number;
  overall_status: string;
  analysis: Array<Record<string, unknown>>;
  engineering_status: Record<string, string>;
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

export interface Scenario {
  id: string;
  name: string;
  scenario_type: string;
  is_manual: boolean;
  poi_id?: string | null;
  results: Record<string, unknown> | null;
}

export interface RankingRequest {
  algorithm: string;
  criteria_values: number[][];
  criterion_types: string[];
  weights: number[];
}

export interface RankingResult {
  algorithm: string;
  scores: number[];
  ranking: Array<{ index: number; score: number; rank: number }>;
}

export const POINT_SUBTYPES = ['gas_processing', 'gtes', 'substation', 'refinery'] as const;
export const LINE_SUBTYPES = ['autoroad', 'oil_pipeline', 'gas_pipeline', 'water_pipeline', 'power_line'] as const;

export const SUBTYPE_LABELS: Record<string, string> = {
  autoroad: 'Автодорога',
  oil_pipeline: 'Нефтепровод',
  gas_pipeline: 'Газопровод',
  water_pipeline: 'Водопровод',
  power_line: 'ЛЭП',
  gas_processing: 'ГКС',
  gtes: 'ГТЭС/ГПЭС',
  substation: 'ПС/ТП',
  refinery: 'НПЗ',
};
