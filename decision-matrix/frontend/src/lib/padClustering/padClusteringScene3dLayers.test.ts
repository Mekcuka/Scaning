import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  applyPadClusteringLayerVisibility,
  clusteringWellLabel,
  DEFAULT_PAD_CLUSTERING_SCENE_LAYERS,
  PAD_CLUSTERING_SCENE_LAYER_NAMES,
} from './padClusteringScene3dLayers';

describe('padClusteringScene3dLayers', () => {
  it('defaults all layers to visible', () => {
    expect(DEFAULT_PAD_CLUSTERING_SCENE_LAYERS).toEqual({
      ground: true,
      pad: true,
      envelope: true,
      wellheads: true,
      wellLabels: true,
      trajectories: true,
      clearancePairs: true,
      pywellgeoBranches: true,
      bottomholes: true,
    });
  });

  it('applyPadClusteringLayerVisibility toggles mesh layer groups', () => {
    const root = new THREE.Group();
    for (const name of Object.values(PAD_CLUSTERING_SCENE_LAYER_NAMES)) {
      const layer = new THREE.Group();
      layer.name = name;
      root.add(layer);
    }

    applyPadClusteringLayerVisibility(root, {
      ...DEFAULT_PAD_CLUSTERING_SCENE_LAYERS,
      pad: false,
      trajectories: false,
    });

    expect(root.getObjectByName(PAD_CLUSTERING_SCENE_LAYER_NAMES.pad)?.visible).toBe(false);
    expect(root.getObjectByName(PAD_CLUSTERING_SCENE_LAYER_NAMES.trajectories)?.visible).toBe(
      false,
    );
    expect(root.getObjectByName(PAD_CLUSTERING_SCENE_LAYER_NAMES.ground)?.visible).toBe(true);
  });

  it('clusteringWellLabel prefers trajectory name', () => {
    expect(clusteringWellLabel(0)).toBe('Скв-1');
    expect(clusteringWellLabel(2, '  A-12  ')).toBe('A-12');
  });
});
