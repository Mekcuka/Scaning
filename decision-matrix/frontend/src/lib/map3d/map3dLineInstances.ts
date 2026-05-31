import type { InfraLayer, InfraObject } from '../api';
import { isLineSubtype, getLineCoordinates } from '../infraGeometry';
import { layerMaps, layerVisible, resolveColor } from './geoJson';
import { altitudeForModelPlacement } from './map3dModelsLayer';
import { scaleMap3dMeters } from './map3dConfig';
import { resolveRender3D } from './render3d';

export type Map3dLineInstance = {
  id: string;
  subtype: string;
  color: string;
  opacity: number;
  /** [lon, lat] per vertex */
  path: [number, number][];
  /** meters above sea (with terrain when enabled) */
  alts: number[];
  /** tube radius in meters */
  radiusM: number;
  /** render_3d_base_m for terrain sampling */
  baseM: number;
  selected: boolean;
};

const LINE_RADIUS_M: Record<string, number> = {
  autoroad: 4,
  oil_pipeline: 2.5,
  gas_pipeline: 2.5,
  water_pipeline: 2,
  power_line: 1.5,
  methanol_pipeline: 2,
  additional_line: 2,
};

const DEFAULT_RADIUS_M = 2.5;

export function buildMap3dLineInstances(
  map: import('maplibre-gl').Map,
  input: {
    infraObjects: InfraObject[];
    layers?: InfraLayer[];
    selectedFeatureId?: string | null;
  },
): Map3dLineInstance[] {
  const maps = layerMaps(input.layers);
  const selectedId = input.selectedFeatureId ?? null;
  const out: Map3dLineInstance[] = [];

  for (const obj of input.infraObjects) {
    if (!layerVisible(obj.layer_id, maps)) continue;
    if (!isLineSubtype(obj.subtype)) continue;

    const render = resolveRender3D(obj.subtype, obj.properties);
    if (!render.visible) continue;

    const coords = getLineCoordinates(obj);
    if (!coords || coords.length < 2) continue;

    const path = coords.map((c) => [c[0], c[1]] as [number, number]);
    const alts = path.map((p) =>
      altitudeForModelPlacement(map, p[0], p[1], render.baseM),
    );
    const height = render.heightM;
    const radius = scaleMap3dMeters(
      LINE_RADIUS_M[obj.subtype] ??
        Math.max(1.2, Math.min(6, height > 0 ? height * 0.35 : DEFAULT_RADIUS_M)),
    );

    out.push({
      id: obj.id,
      subtype: obj.subtype,
      color: resolveColor(obj.subtype, obj.layer_id, maps),
      opacity: obj.layer_id ? (maps.opacityByLayer[obj.layer_id] ?? 1) : 1,
      path,
      alts,
      radiusM: radius,
      baseM: render.baseM,
      selected: selectedId === obj.id,
    });
  }

  return out;
}
