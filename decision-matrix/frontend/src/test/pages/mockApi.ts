import { vi } from 'vitest';
import { sampleProjects } from '../fixtures/projects';
import { sampleInfra, sampleLayers, samplePois, makeAnalysisResponse, makeAnalysisResult } from '../fixtures/map';
import { makeProject } from '../fixtures/projects';

export type ApiMockOverrides = Record<string, unknown>;

/** Default resolved API methods for page integration tests. */
export function createDefaultApiMocks(): ApiMockOverrides {
  return {
    projects: vi.fn().mockResolvedValue(sampleProjects),
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
    updateLayer: vi.fn().mockResolvedValue(sampleLayers[0]),
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
  return {
    ...actual,
    api: {
      ...actual.api,
      ...defaults,
      ...overrides,
    },
  };
}
