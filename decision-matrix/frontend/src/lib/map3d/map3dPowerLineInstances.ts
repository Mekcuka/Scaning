import type { InfraLayer, InfraObject } from '../api';
import { getLineCoordinates, isLineSubtype } from '../infraGeometry';
import { layerMaps, layerVisible, resolveColor } from './geoJson';
import { altitudeForModelPlacement } from './map3dModelsLayer';
import {
  resolvePowerLineEndpoints,
  type PowerLineWireEndpoint,
} from './map3dPowerLineEndpoints';
import { resolveRender3D } from './render3d';

export type Map3dPowerLineInstance = {
  id: string;
  /** Source line for endpoint attachment resolution (terrain refresh). */
  line: InfraObject;
  subtype: string;
  color: string;
  opacity: number;
  path: [number, number][];
  alts: number[];
  startWire: PowerLineWireEndpoint;
  finishWire: PowerLineWireEndpoint;
  towerHeightM: number;
  baseM: number;
  selected: boolean;
};

export function buildMap3dPowerLineInstances(
  map: import('maplibre-gl').Map,
  input: {
    infraObjects: InfraObject[];
    layers?: InfraLayer[];
    selectedFeatureId?: string | null;
  },
): Map3dPowerLineInstance[] {
  const maps = layerMaps(input.layers);
  const selectedId = input.selectedFeatureId ?? null;
  const out: Map3dPowerLineInstance[] = [];

  for (const obj of input.infraObjects) {
    if (obj.subtype !== 'power_line') continue;
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
    const { startWire, finishWire } = resolvePowerLineEndpoints(
      map,
      obj,
      input.infraObjects,
      path,
      alts,
    );

    out.push({
      id: obj.id,
      line: obj,
      subtype: obj.subtype,
      color: resolveColor(obj.subtype, obj.layer_id, maps),
      opacity: obj.layer_id ? (maps.opacityByLayer[obj.layer_id] ?? 1) : 1,
      path,
      alts,
      startWire,
      finishWire,
      towerHeightM: render.heightM,
      baseM: render.baseM,
      selected: selectedId === obj.id,
    });
  }

  return out;
}
