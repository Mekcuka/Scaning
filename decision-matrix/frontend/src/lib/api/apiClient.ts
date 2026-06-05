import type {
  AnalysisResult,
  Candidate,
  PoiAnalysisResponse,
  ProjectAnalysisBatchResult,
} from './analysis';
import { applyAuthSession, isNotFoundApiError, request, requestBlob } from './client';
import type {
  DistanceDefaults,
  FacilityInfraObjectCreate,
  InfraLayer,
  InfraObject,
  InfraObjectCreate,
  Map3dCustomModel,
  POI,
  Project,
} from './entities';
import type {
  ImportConnection,
  ImportConnectionCreate,
  ImportLog,
  InfrastructureNetwork,
  NetworkEdge,
  NetworkNode,
} from './importTypes';
import type {
  AdminJobsHealthResponse,
  ProjectJobAdminItem,
  ProjectJobAdminListResponse,
  ProjectJobCreateResponse,
  ProjectJobListResponse,
  ProjectJobResponse,
} from './jobs';
import type {
  AutoroadConnectResult,
  AutoroadNetworkApplyResult,
  NetworkPlanRequest,
  NetworkPlanResponse,
} from './network';
import type {
  OnePager,
  OnePagerCreatePayload,
  OnePagerUpdatePayload,
} from './onePager';
import type { SandLogisticsResult } from './sandLogistics';
import type { AuthSession, AuthUser } from './session';

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
  adminListJobs: (params?: {
    status?: string[];
    job_type?: string;
    project_id?: string;
    limit?: number;
    offset?: number;
  }) => {
    const q = new URLSearchParams();
    if (params?.status?.length) {
      for (const s of params.status) q.append('status', s);
    }
    if (params?.job_type) q.set('job_type', params.job_type);
    if (params?.project_id) q.set('project_id', params.project_id);
    if (params?.limit != null) q.set('limit', String(params.limit));
    if (params?.offset != null) q.set('offset', String(params.offset));
    const qs = q.toString();
    return request<ProjectJobAdminListResponse>(`/admin/jobs${qs ? `?${qs}` : ''}`);
  },
  adminJobsHealth: () => request<AdminJobsHealthResponse>('/admin/jobs/health'),
  adminCancelJob: (jobId: string) =>
    request<ProjectJobAdminItem>(`/admin/jobs/${jobId}/cancel`, { method: 'POST' }),
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
    request<ProjectAnalysisBatchResult | ProjectJobCreateResponse>(
      `/projects/${projectId}/pois/analyze-all`,
      { method: 'POST', timeoutMs: 120_000 },
    ),
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
  autoroadConnect: (
    projectId: string,
    data: { object_ids: string[]; dry_run?: boolean },
    opts?: { timeoutMs?: number },
  ) =>
    request<AutoroadConnectResult | ProjectJobCreateResponse>(
      `/projects/${projectId}/infrastructure/autoroad-connect`,
      {
        method: 'POST',
        body: JSON.stringify(data),
        timeoutMs: opts?.timeoutMs ?? 120_000,
      },
    ),
  autoroadNetworkSolverStatus: () =>
    request<{
      steinerpy: boolean;
      geosteiner: boolean;
      default_solver: string;
    }>('/autoroad-network/solver-status'),

  autoroadNetworkBuildRequest: (
    projectId: string,
    data: { object_ids: string[]; full_network_rebuild?: boolean },
    opts?: { timeoutMs?: number },
  ) =>
    request<NetworkPlanRequest>(`/projects/${projectId}/autoroad-network/request`, {
      method: 'POST',
      body: JSON.stringify({
        object_ids: data.object_ids,
        full_network_rebuild: data.full_network_rebuild ?? true,
      }),
      timeoutMs: opts?.timeoutMs ?? 120_000,
    }),

  autoroadNetworkCompute: (
    projectId: string,
    planRequest: NetworkPlanRequest,
    opts?: { timeoutMs?: number },
  ) =>
    request<NetworkPlanResponse>(`/projects/${projectId}/autoroad-network/compute`, {
      method: 'POST',
      body: JSON.stringify(planRequest),
      timeoutMs: opts?.timeoutMs ?? 120_000,
    }),

  autoroadNetworkApply: (
    projectId: string,
    data: {
      object_ids: string[];
      plan: NetworkPlanResponse;
      full_network_rebuild?: boolean;
    },
    opts?: { timeoutMs?: number },
  ) =>
    request<AutoroadNetworkApplyResult | ProjectJobCreateResponse>(
      `/projects/${projectId}/autoroad-network/apply`,
      {
        method: 'POST',
        body: JSON.stringify({
          object_ids: data.object_ids,
          plan: data.plan,
          full_network_rebuild: data.full_network_rebuild ?? true,
        }),
        timeoutMs: opts?.timeoutMs ?? 120_000,
      },
    ),

  /** @deprecated Use buildRequest + compute */
  autoroadNetworkPlan: async (
    projectId: string,
    data: { object_ids: string[] },
    opts?: { timeoutMs?: number },
  ) => {
    const timeoutMs = opts?.timeoutMs ?? 120_000;
    try {
      return await request<AutoroadConnectResult>(
        `/projects/${projectId}/autoroad-network/plan`,
        {
          method: 'POST',
          body: JSON.stringify({ ...data, dry_run: true, full_network_rebuild: true }),
          timeoutMs,
        },
      );
    } catch (err) {
      if (!isNotFoundApiError(err)) throw err;
      return request<AutoroadConnectResult>(
        `/projects/${projectId}/infrastructure/autoroad-connect`,
        {
          method: 'POST',
          body: JSON.stringify({ ...data, dry_run: true }),
          timeoutMs,
        },
      );
    }
  },
  getActiveProjectJob: (projectId: string) =>
    request<ProjectJobResponse | null>(`/projects/${projectId}/jobs/active`),
  listProjectJobs: (projectId: string, opts?: { limit?: number }) => {
    const limit = opts?.limit ?? 30;
    return request<ProjectJobListResponse>(`/projects/${projectId}/jobs?limit=${limit}`);
  },
  getProjectJob: (projectId: string, jobId: string) =>
    request<ProjectJobResponse>(`/projects/${projectId}/jobs/${jobId}`),
  cancelProjectJob: (projectId: string, jobId: string) =>
    request<ProjectJobResponse>(`/projects/${projectId}/jobs/${jobId}/cancel`, { method: 'POST' }),
  createProjectJob: (projectId: string, data: { job_type: string; payload?: Record<string, unknown> }) =>
    request<ProjectJobCreateResponse>(`/projects/${projectId}/jobs`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  batchDeleteMapObjects: (
    projectId: string,
    data: { object_ids: string[]; poi_ids?: string[] },
  ) =>
    request<{ deleted_objects: number; deleted_pois: number; network_rebuilt: boolean }>(
      `/projects/${projectId}/map/batch-delete`,
      { method: 'POST', body: JSON.stringify(data) },
    ),
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
  analyzeSandLogistics: (
    projectId: string,
    options?: {
      asOf?: string;
      horizonFrom?: string;
      horizonTo?: string;
      rebuildNetwork?: boolean;
    },
  ) =>
    request<SandLogisticsResult | ProjectJobCreateResponse>(
      `/projects/${projectId}/sand-logistics/analyze`,
      {
        method: 'POST',
        body: JSON.stringify({
          as_of: options?.asOf ?? null,
          horizon_from: options?.horizonFrom ?? null,
          horizon_to: options?.horizonTo ?? null,
          rebuild_network: options?.rebuildNetwork ?? true,
        }),
        timeoutMs: 120_000,
      },
    ),
  getSandLogisticsResult: (projectId: string) =>
    request<SandLogisticsResult | null>(`/projects/${projectId}/sand-logistics/result`, {
      allowNotFound: true,
    }),
  getFlowSchematic: (projectId: string, poiId: string) =>
    request<import('../flowSchematic').FlowSchematicDto>(
      `/projects/${projectId}/pois/${poiId}/flow-schematic`
    ),
  saveFlowSchematic: (
    projectId: string,
    poiId: string,
    body: { nodes: import('../flowSchematic').FlowSchematicNodeDto[]; edges: import('../flowSchematic').FlowSchematicEdgeDto[] }
  ) =>
    request<import('../flowSchematic').FlowSchematicDto>(
      `/projects/${projectId}/pois/${poiId}/flow-schematic`,
      { method: 'PUT', body: JSON.stringify(body) }
    ),
  resetFlowSchematic: (projectId: string, poiId: string) =>
    request<import('../flowSchematic').FlowSchematicDto>(
      `/projects/${projectId}/pois/${poiId}/flow-schematic`,
      { method: 'DELETE' }
    ),
  getEconomicFlowSchematic: (projectId: string, poiId: string) =>
    request<import('../economicFlowSchematic').EconomicFlowSchematicDto>(
      `/projects/${projectId}/pois/${poiId}/economic-flow-schematic`
    ),
  getEconomicParams: (projectId: string) =>
    request<import('../economicFlowSchematic').EconomicParamsDto>(
      `/projects/${projectId}/economic-params`
    ),
  updateEconomicParams: (projectId: string, params: Record<string, number>) =>
    request<import('../economicFlowSchematic').EconomicParamsDto>(
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
