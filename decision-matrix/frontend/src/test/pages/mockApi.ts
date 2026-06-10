import { vi } from 'vitest';
import { sampleProjects } from '../fixtures/projects';
import { sampleInfra, sampleLayers, samplePois, makeAnalysisResponse, makeAnalysisResult } from '../fixtures/map';
import { makeProject } from '../fixtures/projects';

export type ApiMockOverrides = Record<string, unknown>;

/** Default resolved API methods for page integration tests. */
export function createDefaultApiMocks(): ApiMockOverrides {
  return {
    projects: vi.fn().mockResolvedValue(sampleProjects),
    createProject: vi.fn().mockImplementation((name: string, description?: string) =>
      Promise.resolve(
        makeProject({
          id: 'p-new',
          name,
          description: description ?? null,
        }),
      ),
    ),
    updateProject: vi.fn().mockImplementation((id: string, data: Partial<{ name: string; description: string; status: string }>) =>
      Promise.resolve(makeProject({ id, ...data })),
    ),
    deleteProject: vi.fn().mockResolvedValue(undefined),
    getProject: vi.fn().mockImplementation((id: string) =>
      Promise.resolve(makeProject({ id, name: 'Test project' })),
    ),
    getPois: vi.fn().mockResolvedValue(samplePois),
    getLayers: vi.fn().mockResolvedValue(sampleLayers),
    getInfraObjects: vi.fn().mockResolvedValue(sampleInfra),
    listMap3dCustomModels: vi.fn().mockResolvedValue([]),
    uploadMap3dCustomModel: vi.fn().mockResolvedValue({
      id: 'm1',
      project_id: 'p1',
      filename: 'test.glb',
      target_height_m: 8,
      created_at: '2026-01-01T00:00:00Z',
      assigned_subtypes: [],
    }),
    deleteMap3dCustomModel: vi.fn().mockResolvedValue(undefined),
    assignMap3dCustomModel: vi.fn().mockResolvedValue({
      id: 'm1',
      project_id: 'p1',
      filename: 'test.glb',
      target_height_m: 8,
      created_at: '2026-01-01T00:00:00Z',
      assigned_subtypes: ['node'],
    }),
    getDistanceDefaults: vi.fn().mockResolvedValue({}),
    getPoiAnalysis: vi.fn().mockResolvedValue(makeAnalysisResponse()),
    analyzeAllPois: vi.fn().mockResolvedValue(makeAnalysisResult()),
    createPoi: vi.fn().mockImplementation((_pid: string, data: { name?: string }) =>
      Promise.resolve({ ...samplePois[0], ...data, id: 'poi-new' }),
    ),
    updatePoi: vi.fn().mockResolvedValue(samplePois[0]),
    deletePoi: vi.fn().mockResolvedValue(undefined),
    createInfraObject: vi.fn().mockImplementation((_pid: string, data: { name?: string }) =>
      Promise.resolve({ ...sampleInfra[0], ...data, id: 'infra-new' }),
    ),
    createFacilityInfraObject: vi.fn().mockImplementation((_pid: string, data: { name?: string }) =>
      Promise.resolve({ ...sampleInfra[0], ...data, id: 'infra-facility-new' }),
    ),
    updateInfraObject: vi.fn().mockResolvedValue(sampleInfra[0]),
    deleteInfraObject: vi.fn().mockResolvedValue(undefined),
    batchDeleteMapObjects: vi.fn().mockResolvedValue({
      deleted_objects: 1,
      deleted_pois: 0,
      network_rebuilt: false,
    }),
    batchPasteMapObjects: vi.fn().mockImplementation(
      (
        _pid: string,
        data: {
          pois: { create: { name: string; lon: number; lat: number } }[];
          infra_points: {
            create: { name: string; subtype: string; lon: number; lat: number };
            target_subtype?: string | null;
          }[];
          infra_lines: { create: { name: string; subtype: string; lon: number; lat: number } }[];
        },
      ) =>
        Promise.resolve({
          created_pois: data.pois.map((item, i) => ({
            ...samplePois[0],
            id: `poi-paste-${i}`,
            name: item.create.name,
            lon: item.create.lon,
            lat: item.create.lat,
          })),
          created_infra: [
            ...data.infra_points.map((item, i) => ({
              ...sampleInfra[0],
              id: `infra-point-${i}`,
              name: item.create.name,
              subtype: item.target_subtype ?? item.create.subtype,
              lon: item.create.lon,
              lat: item.create.lat,
            })),
            ...data.infra_lines.map((item, i) => ({
              ...sampleInfra[0],
              id: `infra-line-${i}`,
              name: item.create.name,
              subtype: item.create.subtype,
              lon: item.create.lon,
              lat: item.create.lat,
            })),
          ],
          network_rebuilt: data.infra_lines.length > 0,
        }),
    ),
    updateLayer: vi.fn().mockResolvedValue(sampleLayers[0]),
    autoroadNetworkSolverStatus: vi.fn().mockResolvedValue({
      steinerpy: true,
      geosteiner: false,
      default_solver: 'steinerpy',
    }),
    autoroadNetworkBuildRequest: vi.fn().mockImplementation(
      (_projectId: string, data: { object_ids: string[] }) =>
        Promise.resolve({
          project_id: 'p1',
          terminals: data.object_ids.map((id) => ({
            id,
            subtype: 'gas_processing',
            name: `Terminal ${id}`,
            lon: 37.6,
            lat: 55.75,
            coordinates: [37.6, 55.75],
          })),
          existing_autoroads: [],
          options: {},
        }),
    ),
    autoroadNetworkCompute: vi.fn().mockImplementation(
      (_projectId: string, planRequest: { terminals: { id: string }[] }) =>
        Promise.resolve({
          terminals: planRequest.terminals.map((t) => ({
            id: t.id,
            name: `Terminal ${t.id}`,
            warning: null,
          })),
          new_lines: [
            {
              kind: 'link',
              coordinates: [
                [37.6, 55.75],
                [37.65, 55.76],
              ],
            },
          ],
          new_nodes: [{ lon: 37.625, lat: 55.755, reason: 'junction' }],
          splits: [],
          used_existing_edge_ids: [],
          total_new_km: 2.5,
          warnings: [],
          new_line_count: 1,
          new_node_count: 1,
          split_count: 0,
        }),
    ),
    autoroadNetworkApply: vi.fn().mockResolvedValue({
      created_line_ids: ['line-new-1'],
      created_node_ids: ['node-new-1'],
      created_lines: 1,
      created_nodes: 1,
    }),
    getActiveProjectJob: vi.fn().mockResolvedValue(null),
    autoroadConnect: vi.fn().mockResolvedValue({
      dry_run: true,
      new_line_count: 0,
      new_node_count: 0,
      split_count: 0,
      total_new_km: 0,
      warnings: [],
      terminals: [],
    }),
    buildNetwork: vi.fn().mockResolvedValue({}),
    overrideAnalysis: vi.fn().mockResolvedValue(makeAnalysisResponse()),
    getOnePagers: vi.fn().mockResolvedValue([]),
    getOnePager: vi.fn().mockResolvedValue({ id: 'r1', title: 'Report', status: 'ready', content: {} }),
    createOnePager: vi.fn().mockResolvedValue({ id: 'r-new' }),
    updateOnePager: vi.fn().mockResolvedValue({ id: 'r1' }),
    deleteOnePager: vi.fn().mockResolvedValue(undefined),
    exportOnePagerPptx: vi.fn().mockResolvedValue(new Blob()),
    adminUsers: vi.fn().mockResolvedValue([]),
    adminStats: vi.fn().mockResolvedValue({ users: 1, projects: 2, pois: 3 }),
    adminListJobs: vi.fn().mockResolvedValue({ items: [], total: 0, limit: 50, offset: 0 }),
    adminJobsHealth: vi.fn().mockResolvedValue({
      redis_ok: false,
      queue_name: 'arq:queue',
      jobs_use_queue: false,
      jobs_by_status: {},
      active_jobs: [],
    }),
    adminCancelJob: vi.fn().mockResolvedValue({
      id: 'j1',
      project_id: 'p1',
      job_type: 'poi_analyze_all',
      status: 'cancelled',
      user_email: '',
      user_username: '',
      project_name: '',
    }),
    getAssistantLlmConfig: vi.fn().mockResolvedValue({
      provider_ready: true,
      chat_enabled: true,
      effective: {
        base_url: 'https://openrouter.ai/api/v1',
        model: 'test-model',
        api_key_masked: '***abcd',
        api_key_source: 'env',
        max_tokens: 4096,
        timeout_seconds: 120,
      },
      embedding_effective: {
        base_url: 'https://openrouter.ai/api/v1',
        model: 'text-embedding-3-small',
        api_key_masked: null,
        uses_chat_config: true,
      },
      env: {
        base_url: 'https://openrouter.ai/api/v1',
        model: 'test-model',
        max_tokens: 4096,
        timeout_seconds: 120,
        api_key_configured: true,
      },
      runtime_override: {},
      wiki_rag: { enabled: false, embedding_ready: null },
    }),
    updateAssistantLlmConfig: vi.fn().mockResolvedValue({ applied: {} }),
    resetAssistantLlmConfig: vi.fn().mockResolvedValue({ applied: {} }),
    probeAssistantLlm: vi.fn().mockResolvedValue({
      provider_ready: true,
      rag_mode: 'tfidf',
      chat: {
        ok: true,
        models: { ok: true, http_status: 200, hint_ru: 'OK' },
        completion: { ok: true, http_status: 200, hint_ru: 'OK' },
      },
      embeddings: { ok: false, http_status: 404, hint_ru: 'not found' },
    }),
    testAssistantLlm: vi.fn().mockResolvedValue({
      ok: true,
      latency_ms: 10,
      model: 'test-model',
      reply: 'OK',
      error: null,
    }),
    listAssistantLlmModels: vi.fn().mockResolvedValue({ models: [] }),
    updateAdminUser: vi.fn().mockResolvedValue({}),
    getEconomicFlow: vi.fn().mockResolvedValue({}),
    getEconomicFlowSchematic: vi.fn().mockResolvedValue({ nodes: [], edges: [] }),
    getFlowSchematic: vi.fn().mockResolvedValue({ nodes: [], edges: [], source: 'computed', warnings: [] }),
    saveFlowSchematic: vi.fn().mockResolvedValue({ nodes: [], edges: [], source: 'computed', warnings: [] }),
    analyzeSandLogistics: vi.fn().mockResolvedValue({ subnets: [], subnet_count: 0, as_of: '2024-01-01' }),
    getSandLogisticsResult: vi.fn().mockResolvedValue(null),
    login: vi.fn().mockResolvedValue({ id: 'u1', email: 'a@b.ru', username: 'u', role: 'analyst' }),
    register: vi.fn().mockResolvedValue({ id: 'u1', email: 'a@b.ru', username: 'u', role: 'analyst' }),
    me: vi.fn().mockResolvedValue({ id: 'u1', email: 'a@b.ru', username: 'u', role: 'analyst', is_active: true }),
    updateRates: vi.fn().mockResolvedValue({}),
    getRates: vi.fn().mockResolvedValue({}),
    getMatrix: vi.fn().mockResolvedValue({}),
    importPreview: vi.fn().mockResolvedValue({ rows: [], errors: [] }),
    importGeoJson: vi.fn().mockResolvedValue({ imported: 0 }),
    listImportConnections: vi.fn().mockResolvedValue([]),
    createImportConnection: vi.fn().mockResolvedValue({ id: 'c1', name: 'API' }),
    previewImport: vi.fn().mockResolvedValue({ rows: [], errors: [] }),
    importCsv: vi.fn().mockResolvedValue({
      id: 'log-1',
      status: 'completed',
      records_imported: 1,
      records_total: 1,
    }),
    importGeojson: vi.fn().mockResolvedValue({
      id: 'log-2',
      status: 'completed',
      records_imported: 1,
      records_total: 1,
    }),
    importGeojsonAsync: vi.fn().mockResolvedValue({
      id: 'log-3',
      status: 'pending',
      records_imported: 0,
      records_total: 1,
    }),
    testImportConnection: vi.fn().mockResolvedValue({ ok: true }),
    syncImportConnection: vi.fn().mockResolvedValue({ imported: 1 }),
  };
}

/** Merge defaults with overrides for vi.mock factory. */
export async function buildApiMock(overrides: ApiMockOverrides = {}) {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  const defaults = createDefaultApiMocks();
  const mockedApi = {
    ...actual.api,
    ...defaults,
    ...overrides,
  };
  return {
    ...actual,
    api: mockedApi,
    defaultProjectsListApi: { projects: mockedApi.projects },
    defaultProjectsDataApi: { getPois: mockedApi.getPois },
    defaultMapDataApi: {
      getInfraObjects: mockedApi.getInfraObjects,
      getLayers: mockedApi.getLayers,
    },
    defaultMapInfraApi: { getInfraObjects: mockedApi.getInfraObjects },
  };
}
