import { mapApi } from '../mapApi';

/** Narrow map API for infra, layers, and 3D assets on project/map hooks. */
export type MapDataApiPort = Pick<
  typeof mapApi,
  'getInfraObjects' | 'getLayers' | 'updateLayer' | 'listMap3dCustomModels'
>;

export const defaultMapDataApi: MapDataApiPort = mapApi;

/** Create/update/delete infra objects and batch map mutations. */
export type MapMutationsApiPort = Pick<
  typeof mapApi,
  | 'createInfraObject'
  | 'updateInfraObject'
  | 'deleteInfraObject'
  | 'batchDeleteMapObjects'
  | 'batchPasteMapObjects'
>;

export const defaultMapMutationsApi: MapMutationsApiPort = mapApi;

/** @deprecated Use MapDataApiPort */
export type MapInfraApiPort = Pick<typeof mapApi, 'getInfraObjects'>;

/** @deprecated Use defaultMapDataApi */
export const defaultMapInfraApi: MapInfraApiPort = mapApi;
