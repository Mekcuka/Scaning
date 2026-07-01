import type { InfraLayer, InfraObject } from '../api';
import { isLineSubtype } from '../infraGeometry';
import { isBottomholeSubtype } from '../wellBottomholeProperties';
import { layerMaps, layerVisible, resolveColor } from './geoJson';
import { buildNormalizedLinePath3d } from './map3dLinePathBuild';
import { resolveLineTubeRadiusM } from './map3dLineTubeRadius';
import { resolveRender3D } from './render3d';

export type Map3dLineInstance = {
  id: string;
  /** Source line — used to re-sync path with 2D on terrain refresh. */
  line: InfraObject;
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

export function buildMap3dLineInstances(
  map: import('maplibre-gl').Map,
  input: {
    infraObjects: InfraObject[];
    /** Full project list for endpoint snap (defaults to infraObjects). */
    snapPool?: InfraObject[];
    layers?: InfraLayer[];
    selectedFeatureId?: string | null;
  },
): Map3dLineInstance[] {
  const maps = layerMaps(input.layers);
  const selectedId = input.selectedFeatureId ?? null;
  const out: Map3dLineInstance[] = [];

  for (const obj of input.infraObjects) {
    if (!layerVisible(obj.layer_id, maps)) continue;
    if (isBottomholeSubtype(obj.subtype)) continue;
    if (!isLineSubtype(obj.subtype)) continue;
    if (obj.subtype === 'power_line') continue;

    const render = resolveRender3D(obj.subtype, obj.properties);
    if (!render.visible) continue;

    const built = buildNormalizedLinePath3d(
      map,
      obj,
      input.infraObjects,
      render.baseM,
      input.snapPool,
    );
    if (!built) continue;
    const { path, alts } = built;
    const radius = resolveLineTubeRadiusM(obj.subtype, render);

    out.push({
      id: obj.id,
      line: obj,
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
