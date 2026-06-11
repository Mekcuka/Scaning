import { projectsApi } from '../projectsApi';

/** Narrow projects API for listing and resolving active project. */
export type ProjectsListApiPort = Pick<typeof projectsApi, 'projects'>;

/** Project detail and POI queries. */
export type ProjectsDataApiPort = Pick<typeof projectsApi, 'getPois' | 'getProject'>;

/** Create/update/delete project from projects UI. */
export type ProjectsWriteApiPort = Pick<
  typeof projectsApi,
  'createProject' | 'updateProject' | 'deleteProject'
>;

/** Rates, economic params, and distance defaults on Rates page. */
export type ProjectsRatesApiPort = Pick<
  typeof projectsApi,
  | 'getRates'
  | 'updateRates'
  | 'getEconomicParams'
  | 'updateEconomicParams'
  | 'getDistanceDefaults'
  | 'updateDistanceDefaults'
  | 'getPoiRates'
  | 'updatePoiRates'
  | 'getPoiEconomicParams'
  | 'updatePoiEconomicParams'
  | 'getPoiDistanceSettings'
  | 'updatePoiDistanceSettings'
>;

/** POI create/update/delete on the map. */
export type ProjectsPoiWriteApiPort = Pick<
  typeof projectsApi,
  'createPoi' | 'updatePoi' | 'deletePoi'
>;

/** Distance defaults for map analysis UI. */
export type ProjectsMapSettingsApiPort = Pick<typeof projectsApi, 'getDistanceDefaults'>;

export const defaultProjectsListApi: ProjectsListApiPort = projectsApi;
export const defaultProjectsDataApi: ProjectsDataApiPort = projectsApi;
export const defaultProjectsWriteApi: ProjectsWriteApiPort = projectsApi;
export const defaultProjectsPoiWriteApi: ProjectsPoiWriteApiPort = projectsApi;
export const defaultProjectsMapSettingsApi: ProjectsMapSettingsApiPort = projectsApi;
export const defaultProjectsRatesApi: ProjectsRatesApiPort = projectsApi;
