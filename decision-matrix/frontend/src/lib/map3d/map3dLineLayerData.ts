import type { InfraLayer, InfraObject } from '../api';
import { buildMap3dLineInstances, type Map3dLineInstance } from './map3dLineInstances';
import {
  buildMap3dPowerLineInstances,
  type Map3dPowerLineInstance,
} from './map3dPowerLineInstances';

export type Map3dLineLayerData = {
  tubes: Map3dLineInstance[];
  powerLines: Map3dPowerLineInstance[];
  /** Required to refresh ЛЭП wire endpoints after terrain updates. */
  infraObjects: InfraObject[];
  /** Full snap pool (all visible infra); used on terrain refresh so wire ends stay on nodes. */
  snapPool?: InfraObject[];
};

export function buildMap3dLineLayerData(
  map: import('maplibre-gl').Map,
  input: {
    infraObjects: InfraObject[];
    snapPool?: InfraObject[];
    layers?: InfraLayer[];
    selectedFeatureId?: string | null;
  },
): Map3dLineLayerData {
  return {
    tubes: buildMap3dLineInstances(map, input),
    powerLines: buildMap3dPowerLineInstances(map, input),
    infraObjects: input.infraObjects,
    snapPool: input.snapPool,
  };
}
