import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { MAP3D_OBJECT_SCALE } from '../map3dConfig';
import { buildMap3dLinearFeatureMatrix, buildMap3dPointModelMatrix } from '../map3dThreeMatrix';

const anchor = {
  translateX: 0.5,
  translateY: 0.5,
  translateZ: 0,
  scale: 1e-6,
};

describe('map3dThreeMatrix', () => {
  it('applies MAP3D_OBJECT_SCALE only for point models', () => {
    const rotX = new THREE.Matrix4();
    const point = buildMap3dPointModelMatrix(anchor, 1, new THREE.Matrix4(), rotX);
    const linear = buildMap3dLinearFeatureMatrix(anchor, 1, new THREE.Matrix4(), rotX);
    const sx = new THREE.Vector3();
    point.decompose(new THREE.Vector3(), new THREE.Quaternion(), sx);
    const lx = new THREE.Vector3();
    linear.decompose(new THREE.Vector3(), new THREE.Quaternion(), lx);
    expect(Math.abs(sx.x) / Math.abs(lx.x)).toBeCloseTo(MAP3D_OBJECT_SCALE, 4);
  });
});
