/** Wire DIP default ports to the same mocked methods as `api` (Phase 4). */
function createDefaultPorts(mockedApi: Record<string, unknown>) {
  return {
    defaultProjectsListApi: {
      projects: mockedApi.projects,
    },
    defaultProjectsDataApi: {
      getPois: mockedApi.getPois,
      getProject: mockedApi.getProject,
    },
    defaultMapDataApi: {
      getInfraObjects: mockedApi.getInfraObjects,
      getLayers: mockedApi.getLayers,
      updateLayer: mockedApi.updateLayer,
      listMap3dCustomModels: mockedApi.listMap3dCustomModels,
    },
    defaultMapInfraApi: {
      getInfraObjects: mockedApi.getInfraObjects,
    },
    defaultSandLogisticsReadApi: {
      getSandLogisticsResult: mockedApi.getSandLogisticsResult,
    },
    defaultSandLogisticsApi: {
      getSandLogisticsResult: mockedApi.getSandLogisticsResult,
      analyzeSandLogistics: mockedApi.analyzeSandLogistics,
    },
    defaultFlowSchematicApi: {
      getFlowSchematic: mockedApi.getFlowSchematic,
      getEconomicFlowSchematic: mockedApi.getEconomicFlowSchematic,
      saveFlowSchematic: mockedApi.saveFlowSchematic,
      resetFlowSchematic: mockedApi.resetFlowSchematic,
    },
    defaultOnePagerListApi: {
      getOnePagers: mockedApi.getOnePagers,
      deleteOnePager: mockedApi.deleteOnePager,
      exportOnePagerPptx: mockedApi.exportOnePagerPptx,
    },
    defaultOnePagerEditorApi: {
      getOnePager: mockedApi.getOnePager,
      createOnePager: mockedApi.createOnePager,
      updateOnePager: mockedApi.updateOnePager,
      exportOnePagerPptx: mockedApi.exportOnePagerPptx,
    },
    defaultMapAnalysisApi: {
      getPoiAnalysis: mockedApi.getPoiAnalysis,
      overrideAnalysis: mockedApi.overrideAnalysis,
      getCandidates: mockedApi.getCandidates,
    },
    defaultProjectJobsApi: {
      getActiveProjectJob: mockedApi.getActiveProjectJob,
      getProjectJob: mockedApi.getProjectJob,
      listProjectJobs: mockedApi.listProjectJobs,
      cancelProjectJob: mockedApi.cancelProjectJob,
    },
    defaultAuthSessionApi: {
      me: mockedApi.me,
    },
    defaultAuthApi: {
      me: mockedApi.me,
      login: mockedApi.login,
      register: mockedApi.register,
    },
    defaultImportWorkflowApi: {
      getImportLogs: mockedApi.getImportLogs,
      getImportConnections: mockedApi.getImportConnections,
      getImportLog: mockedApi.getImportLog,
      previewImport: mockedApi.previewImport,
      importCsv: mockedApi.importCsv,
      importCsvAsync: mockedApi.importCsvAsync,
      importKml: mockedApi.importKml,
      importKmlAsync: mockedApi.importKmlAsync,
      importGeojson: mockedApi.importGeojson,
      importGeojsonAsync: mockedApi.importGeojsonAsync,
      importSpark: mockedApi.importSpark,
      importSparkAsync: mockedApi.importSparkAsync,
      importShapefile: mockedApi.importShapefile,
      createImportConnection: mockedApi.createImportConnection,
      testImportConnection: mockedApi.testImportConnection,
      syncImportConnection: mockedApi.syncImportConnection,
    },
    defaultMap3dModelsApi: {
      listMap3dCustomModels: mockedApi.listMap3dCustomModels,
      uploadMap3dCustomModel: mockedApi.uploadMap3dCustomModel,
      deleteMap3dCustomModel: mockedApi.deleteMap3dCustomModel,
      assignMap3dCustomModel: mockedApi.assignMap3dCustomModel,
    },
    defaultAdminUsersApi: {
      adminUsers: mockedApi.adminUsers,
      adminStats: mockedApi.adminStats,
      updateAdminUser: mockedApi.updateAdminUser,
    },
    defaultAdminJobsApi: {
      adminListJobs: mockedApi.adminListJobs,
      adminJobsHealth: mockedApi.adminJobsHealth,
      adminCancelJob: mockedApi.adminCancelJob,
    },
    defaultAnalysisBatchApi: {
      analyzeAllPois: mockedApi.analyzeAllPois,
    },
    defaultMapMutationsApi: {
      createInfraObject: mockedApi.createInfraObject,
      updateInfraObject: mockedApi.updateInfraObject,
      deleteInfraObject: mockedApi.deleteInfraObject,
      batchDeleteMapObjects: mockedApi.batchDeleteMapObjects,
      batchPasteMapObjects: mockedApi.batchPasteMapObjects,
    },
    defaultProjectsWriteApi: {
      createProject: mockedApi.createProject,
      updateProject: mockedApi.updateProject,
      deleteProject: mockedApi.deleteProject,
    },
    defaultProjectsRatesApi: {
      getRates: mockedApi.getRates,
      updateRates: mockedApi.updateRates,
      getEconomicParams: mockedApi.getEconomicParams,
      updateEconomicParams: mockedApi.updateEconomicParams,
      getDistanceDefaults: mockedApi.getDistanceDefaults,
      updateDistanceDefaults: mockedApi.updateDistanceDefaults,
    },
    defaultProjectsPoiWriteApi: {
      createPoi: mockedApi.createPoi,
      updatePoi: mockedApi.updatePoi,
      deletePoi: mockedApi.deletePoi,
    },
    defaultProjectsMapSettingsApi: {
      getDistanceDefaults: mockedApi.getDistanceDefaults,
    },
    defaultAutoroadNetworkApi: {
      autoroadConnect: mockedApi.autoroadConnect,
      autoroadNetworkSolverStatus: mockedApi.autoroadNetworkSolverStatus,
      autoroadNetworkBuildRequest: mockedApi.autoroadNetworkBuildRequest,
      autoroadNetworkCompute: mockedApi.autoroadNetworkCompute,
      autoroadNetworkApply: mockedApi.autoroadNetworkApply,
    },
    defaultNetworkBuildApi: {
      buildNetwork: mockedApi.buildNetwork,
    },
    defaultMapUndoApi: {
      createInfraObject: mockedApi.createInfraObject,
      updateInfraObject: mockedApi.updateInfraObject,
      deleteInfraObject: mockedApi.deleteInfraObject,
      batchDeleteMapObjects: mockedApi.batchDeleteMapObjects,
      batchPasteMapObjects: mockedApi.batchPasteMapObjects,
      createPoi: mockedApi.createPoi,
      updatePoi: mockedApi.updatePoi,
      deletePoi: mockedApi.deletePoi,
      buildNetwork: mockedApi.buildNetwork,
    },
  };
}

/** Factory for vi.mock('../lib/api') — use dynamic import inside the mock callback. */
export async function createApiMock(
  importOriginal: <T>() => Promise<T>,
  overrides: Record<string, unknown> = {},
) {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  const { createDefaultApiMocks } = await import('./mockApi');
  const mockedApi = {
    ...actual.api,
    ...createDefaultApiMocks(),
    ...overrides,
  };
  return {
    ...actual,
    api: mockedApi,
    loadLlmLocalPresets: actual.loadLlmLocalPresets ?? (() => []),
    saveLlmLocalPreset: actual.saveLlmLocalPreset ?? (() => undefined),
    ...createDefaultPorts(mockedApi),
  };
}
