/** L3 catalog: subtype → glTF asset and/or procedural fallback (Three.js). */

import { gltfAssetDef } from './map3dGltfAssets';

export type Map3dMeshTemplate =
  | 'facility'
  | 'tall_stack'
  | 'node'
  | 'quarry'
  | 'poi_pin';

export type Map3dModelCatalogEntry = {
  /** Bundled glTF in /public/map3d-models (preferred). */
  gltfAssetId?: string;
  /** Procedural fallback if glTF fails to load. */
  template: Map3dMeshTemplate;
  footprintScale: number;
};

const facilityLarge = (template: Map3dMeshTemplate = 'facility'): Map3dModelCatalogEntry => ({
  gltfAssetId: 'facility-large',
  template,
  footprintScale: 1.2,
});

const facilityMedium: Map3dModelCatalogEntry = {
  gltfAssetId: 'facility-medium',
  template: 'facility',
  footprintScale: 1.1,
};

const facilityCompact: Map3dModelCatalogEntry = {
  gltfAssetId: 'facility-compact',
  template: 'facility',
  footprintScale: 1,
};

/** Default template per infrastructure subtype (point objects). */
export const MAP3D_MODEL_BY_SUBTYPE: Record<string, Map3dModelCatalogEntry> = {
  gas_processing: { ...facilityLarge(), footprintScale: 1.4 },
  refinery: { ...facilityLarge(), footprintScale: 1.6 },
  ukg: facilityMedium,
  tsg: facilityMedium,
  pad: { gltfAssetId: 'oil-pump-jack', template: 'facility', footprintScale: 0.85 },
  preliminary_water_discharge_station: facilityMedium,
  booster_pumping_station: facilityMedium,
  oil_pumping_station: facilityMedium,
  ground_pumping_station: facilityMedium,
  methanol_facility: facilityMedium,
  additional_facility: facilityCompact,
  offplot: facilityCompact,
  substation: { gltfAssetId: 'substation', template: 'facility', footprintScale: 1.1 },
  gtes: { gltfAssetId: 'stack-large', template: 'tall_stack', footprintScale: 0.5 },
  gpes: { gltfAssetId: 'stack-large', template: 'tall_stack', footprintScale: 0.5 },
  vies: { gltfAssetId: 'stack-medium', template: 'tall_stack', footprintScale: 0.55 },
  ie: { gltfAssetId: 'stack-medium', template: 'tall_stack', footprintScale: 0.55 },
  node: { gltfAssetId: 'tank', template: 'node', footprintScale: 1 },
  methanol_joint: { gltfAssetId: 'tank', template: 'node', footprintScale: 0.9 },
  network_node: { gltfAssetId: 'tank', template: 'node', footprintScale: 1 },
  sand_quarry: { gltfAssetId: 'facility-compact', template: 'quarry', footprintScale: 1.8 },
  poi: { template: 'poi_pin', footprintScale: 1 },
};

/** Overrides by `render_3d_model_id` (asset id or legacy alias). */
export const MAP3D_MODEL_BY_ID: Record<string, Map3dModelCatalogEntry> = {
  facility: facilityLarge(),
  'facility-large': facilityLarge(),
  'facility-medium': facilityMedium,
  'facility-compact': facilityCompact,
  substation: { gltfAssetId: 'substation', template: 'facility', footprintScale: 1.1 },
  stack: { gltfAssetId: 'stack-large', template: 'tall_stack', footprintScale: 0.5 },
  'stack-large': { gltfAssetId: 'stack-large', template: 'tall_stack', footprintScale: 0.5 },
  'stack-medium': { gltfAssetId: 'stack-medium', template: 'tall_stack', footprintScale: 0.55 },
  'stack-small': { gltfAssetId: 'stack-small', template: 'tall_stack', footprintScale: 0.45 },
  tank: { gltfAssetId: 'tank', template: 'node', footprintScale: 1 },
  node: { gltfAssetId: 'tank', template: 'node', footprintScale: 1 },
  quarry: { gltfAssetId: 'facility-compact', template: 'quarry', footprintScale: 1.8 },
  'oil-pump-jack': { gltfAssetId: 'oil-pump-jack', template: 'facility', footprintScale: 0.85 },
  poi_pin: { template: 'poi_pin', footprintScale: 1 },
};

export function catalogEntryForSubtype(subtype: string): Map3dModelCatalogEntry | null {
  return MAP3D_MODEL_BY_SUBTYPE[subtype.trim().toLowerCase()] ?? null;
}

export function catalogEntryForModelId(modelId: string): Map3dModelCatalogEntry | null {
  const key = modelId.trim().toLowerCase();
  const byId = MAP3D_MODEL_BY_ID[key];
  if (byId) return byId;
  if (gltfAssetDef(key)) {
    return {
      gltfAssetId: key,
      template: 'facility',
      footprintScale: 1,
    };
  }
  return catalogEntryForSubtype(key);
}
