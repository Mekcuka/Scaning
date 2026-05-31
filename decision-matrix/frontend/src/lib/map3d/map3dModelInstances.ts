import type { InfraLayer, InfraObject, POI } from '../api';
import { isLineSubtype } from '../infraGeometry';
import { MAP_SUBTYPE_COLORS } from '../mapIcons';
import {
  catalogEntryForModelId,
  catalogEntryForSubtype,
  type Map3dModelCatalogEntry,
} from './map3dModelCatalog';
import { layerMaps, layerVisible, resolveColor } from './geoJson';
import {
  RENDER_3D_MODEL_ID_KEY,
  resolveRender3D,
  shouldUse3dModel,
} from './render3d';

export type Map3dModelInstance = {
  id: string;
  kind: 'infra' | 'poi';
  subtype: string;
  lon: number;
  lat: number;
  heightM: number;
  baseM: number;
  color: string;
  catalog: Map3dModelCatalogEntry;
  selected: boolean;
};

function resolveCatalog(
  subtype: string,
  properties?: Record<string, unknown> | null,
): Map3dModelCatalogEntry | null {
  const props = properties ?? undefined;
  const modelId = props?.[RENDER_3D_MODEL_ID_KEY];
  if (typeof modelId === 'string' && modelId.trim()) {
    const byId = catalogEntryForModelId(modelId);
    if (byId) return byId;
  }
  return catalogEntryForSubtype(subtype);
}

export function buildMap3dModelInstances(input: {
  infraObjects: InfraObject[];
  pois: POI[];
  layers?: InfraLayer[];
  showPois?: boolean;
  selectedFeatureId?: string | null;
}): Map3dModelInstance[] {
  const maps = layerMaps(input.layers);
  const selectedId = input.selectedFeatureId ?? null;
  const out: Map3dModelInstance[] = [];

  for (const obj of input.infraObjects) {
    if (!layerVisible(obj.layer_id, maps)) continue;
    if (isLineSubtype(obj.subtype)) continue;

    const render = resolveRender3D(obj.subtype, obj.properties);
    if (!render.visible) continue;
    if (!shouldUse3dModel(obj.subtype, obj.properties)) continue;

    const catalog = resolveCatalog(obj.subtype, obj.properties);
    if (!catalog) continue;

    out.push({
      id: obj.id,
      kind: 'infra',
      subtype: obj.subtype,
      lon: obj.lon,
      lat: obj.lat,
      heightM: render.heightM,
      baseM: render.baseM,
      color: resolveColor(obj.subtype, obj.layer_id, maps),
      catalog,
      selected: selectedId === obj.id,
    });
  }

  if (input.showPois !== false) {
    for (const poi of input.pois) {
      const render = resolveRender3D('poi');
      if (!render.visible) continue;
      if (!shouldUse3dModel('poi')) continue;
      const catalog = resolveCatalog('poi');
      if (!catalog) continue;
      out.push({
        id: poi.id,
        kind: 'poi',
        subtype: 'poi',
        lon: poi.lon,
        lat: poi.lat,
        heightM: render.heightM,
        baseM: render.baseM,
        color: MAP_SUBTYPE_COLORS.poi,
        catalog,
        selected: selectedId === poi.id,
      });
    }
  }

  return out;
}
