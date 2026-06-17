/** Layer visibility for pad clustering 3D scene. */

import type * as THREE from 'three';

export type PadClusteringScene3DLayerKey =
  | 'ground'
  | 'pad'
  | 'envelope'
  | 'wellheads'
  | 'wellLabels'
  | 'trajectories'
  | 'clearancePairs'
  | 'pywellgeoBranches'
  | 'bottomholes';

export type PadClusteringScene3DLayers = Record<PadClusteringScene3DLayerKey, boolean>;

export const DEFAULT_PAD_CLUSTERING_SCENE_LAYERS: PadClusteringScene3DLayers = {
  ground: true,
  pad: true,
  envelope: true,
  wellheads: true,
  wellLabels: true,
  trajectories: true,
  clearancePairs: true,
  pywellgeoBranches: true,
  bottomholes: true,
};

/** Three.js group names (wellLabels is HTML overlay only). */
export const PAD_CLUSTERING_SCENE_LAYER_NAMES = {
  ground: 'layer-ground',
  pad: 'layer-pad',
  envelope: 'layer-envelope',
  wellheads: 'layer-wellheads',
  trajectories: 'layer-trajectories',
  clearancePairs: 'layer-clearance-pairs',
  pywellgeoBranches: 'layer-pywellgeo-branches',
  bottomholes: 'layer-bottomholes',
} as const;

export type PadClusteringScene3DMeshLayerKey = Exclude<
  PadClusteringScene3DLayerKey,
  'wellLabels'
>;

export function applyPadClusteringLayerVisibility(
  root: THREE.Object3D,
  layers: PadClusteringScene3DLayers,
): void {
  for (const key of Object.keys(PAD_CLUSTERING_SCENE_LAYER_NAMES) as PadClusteringScene3DMeshLayerKey[]) {
    const child = root.getObjectByName(PAD_CLUSTERING_SCENE_LAYER_NAMES[key]);
    if (child) child.visible = layers[key];
  }
}

export function clusteringWellLabel(index: number, name?: string | null): string {
  if (name?.trim()) return name.trim();
  return `Скв-${index + 1}`;
}
