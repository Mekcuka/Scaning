import * as THREE from 'three';
import { MAP3D_OBJECT_SCALE } from './map3dConfig';

export const MODEL_ROTATE_X = Math.PI / 2;

/** Z mirror for linear 3D geometry (tubes / ЛЭП / опоры узла ЛЭП). */
const LINE_FLIP_Z_MATRIX = new THREE.Matrix4().makeScale(1, 1, -1);

type MercatorAnchor = {
  translateX: number;
  translateY: number;
  translateZ: number;
  scale: number;
};

/** Point glTF / procedural models (Map3dModelsCustomLayer). */
export function buildMap3dPointModelMatrix(
  t: MercatorAnchor,
  scaleMul: number,
  target: THREE.Matrix4,
  rotX: THREE.Matrix4,
): THREE.Matrix4 {
  const s = t.scale * scaleMul * MAP3D_OBJECT_SCALE;
  rotX.makeRotationAxis(new THREE.Vector3(1, 0, 0), MODEL_ROTATE_X);
  return target
    .identity()
    .makeTranslation(t.translateX, t.translateY, t.translateZ)
    .scale(new THREE.Vector3(s, -s, s))
    .multiply(rotX);
}

/**
 * Same world matrix as Map3dLinesCustomLayer (no MAP3D_OBJECT_SCALE in world scale).
 * Used for `power_line_node` towers so placement matches interior ЛЭП supports.
 */
export function buildMap3dLinearFeatureMatrix(
  t: MercatorAnchor,
  scaleMul: number,
  target: THREE.Matrix4,
  rotX: THREE.Matrix4,
): THREE.Matrix4 {
  const s = t.scale * scaleMul;
  rotX.makeRotationAxis(new THREE.Vector3(1, 0, 0), MODEL_ROTATE_X);
  return target
    .identity()
    .makeTranslation(t.translateX, t.translateY, t.translateZ)
    .scale(new THREE.Vector3(s, -s, s))
    .multiply(rotX)
    .multiply(LINE_FLIP_Z_MATRIX);
}
