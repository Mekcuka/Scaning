import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { scaleGltfGroupToHeightM } from './map3dGltfLoader';
import { innerModelMaxDim, modelGroupFromPlacement, wrapModelWithPlacement } from './map3dModelPlacement';
import { applyInstanceMatrix } from './map3dLayerRender';

describe('map3dModelPlacement', () => {
  it('inner bbox unchanged when mercator matrix applied only on placement wrapper', () => {
    const model = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(4, 8, 4));
    mesh.position.y = 4;
    model.add(mesh);
    scaleGltfGroupToHeightM(model, 12);

    const placement = wrapModelWithPlacement(model);
    const beforeInner = innerModelMaxDim(placement);

    const mercator = new THREE.Matrix4()
      .makeTranslation(0.42, -0.18, 0.05)
      .scale(new THREE.Vector3(2e-8, -2e-8, 2e-8));
    applyInstanceMatrix(placement, mercator);
    placement.updateMatrixWorld(true);

    expect(innerModelMaxDim(placement)).toBeCloseTo(beforeInner, 4);
    expect(modelGroupFromPlacement(placement)).toBe(model);
  });
});
