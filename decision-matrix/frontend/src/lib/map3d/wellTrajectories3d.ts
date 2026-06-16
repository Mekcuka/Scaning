import type { Map as MapLibreMap } from 'maplibre-gl';
import type { FeatureCollection, LineString } from 'geojson';
import type { WellTrajectoryGeoJsonFeature } from '../api/wellTrajectoryApi';
import { MAP3D_LAYER_IDS } from './map3dConfig';
import type { Map3dWellTrajectoriesCustomLayer } from './map3dWellTrajectoriesLayer';

export { parseTrajectoryPath3d } from './map3dWellTrajectoryInstances';

export function wellTrajectories3dGeoJson(
  features: WellTrajectoryGeoJsonFeature[],
): FeatureCollection<LineString> {
  return {
    type: 'FeatureCollection',
    features: features
      .filter((f) => f.properties.kind === 'trajectory' || f.properties.kind === 'pywellgeo_branch')
      .map((f) => ({
        type: 'Feature' as const,
        properties: f.properties,
        geometry: f.geometry as LineString,
      })),
  };
}

/** MapLibre pick-only layer visibility (Three.js renders visible tubes). */
export function setMap3dWellTrajectoriesVisibility(map: MapLibreMap, visible: boolean): void {
  const layerId = MAP3D_LAYER_IDS.wellTrajectories;
  if (!map.getLayer(layerId)) return;
  map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
}

export function syncMap3dWellTrajectoriesThreeLayer(
  layer: Map3dWellTrajectoriesCustomLayer | null,
  visible: boolean,
): void {
  if (!layer) return;
  layer.setVisible(visible);
}
