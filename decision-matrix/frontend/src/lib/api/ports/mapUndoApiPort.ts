import { networkApi } from '../networkApi';
import { defaultMapMutationsApi, type MapMutationsApiPort } from './mapApiPort';
import { defaultProjectsPoiWriteApi, type ProjectsPoiWriteApiPort } from './projectsApiPort';

/** Best-effort network graph rebuild after map mutations. */
export type NetworkBuildApiPort = Pick<typeof networkApi, 'buildNetwork'>;

export const defaultNetworkBuildApi: NetworkBuildApiPort = networkApi;

/** Map undo stack: POI + infra CRUD and network rebuild. */
export type MapUndoApiPort = MapMutationsApiPort & ProjectsPoiWriteApiPort & NetworkBuildApiPort;

export const defaultMapUndoApi: MapUndoApiPort = {
  ...defaultMapMutationsApi,
  ...defaultProjectsPoiWriteApi,
  ...defaultNetworkBuildApi,
};
