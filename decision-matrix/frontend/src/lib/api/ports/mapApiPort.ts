import { mapApi } from '../mapApi';

/** Narrow map API for infra and layers on project/map hooks. */
export type MapDataApiPort = Pick<
  typeof mapApi,
  'getInfraObjects' | 'getLayers'
>;

export const defaultMapDataApi: MapDataApiPort = mapApi;

/** @deprecated Use MapDataApiPort */
export type MapInfraApiPort = Pick<typeof mapApi, 'getInfraObjects'>;

/** @deprecated Use defaultMapDataApi */
export const defaultMapInfraApi: MapInfraApiPort = mapApi;
