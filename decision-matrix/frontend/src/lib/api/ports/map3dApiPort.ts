import { mapApi } from '../mapApi';

/** Custom GLB models on Import 3D page and map data hooks. */
export type Map3dModelsApiPort = Pick<
  typeof mapApi,
  | 'listMap3dCustomModels'
  | 'uploadMap3dCustomModel'
  | 'deleteMap3dCustomModel'
  | 'assignMap3dCustomModel'
  | 'patchMap3dCustomModel'
  | 'previewMap3dCustomModelApply'
>;

export const defaultMap3dModelsApi: Map3dModelsApiPort = mapApi;
