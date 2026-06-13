/** Screen projection helpers for pad 3D overlays. */

import * as THREE from 'three';
import { planEastToSceneX, planNorthToSceneZ } from './padEarthworkScene3d';

export function planWellheadWorldPosition(
  eastM: number,
  northM: number,
  kbM: number,
  offsetAboveKbM = 3.2,
): THREE.Vector3 {
  return new THREE.Vector3(
    planEastToSceneX(eastM),
    kbM + offsetAboveKbM,
    planNorthToSceneZ(northM),
  );
}

export function worldToOverlayPx(
  camera: THREE.Camera,
  width: number,
  height: number,
  world: THREE.Vector3,
): { x: number; y: number } | null {
  if (width <= 0 || height <= 0) return null;
  const projected = world.clone().project(camera);
  if (projected.z < -1 || projected.z > 1) return null;
  return {
    x: ((projected.x + 1) / 2) * width,
    y: ((-projected.y + 1) / 2) * height,
  };
}

/** CSS rotate deg for north arrow; 0 = north up when plan view is locked. */
export function cameraNorthCompassDeg(
  camera: THREE.Camera,
  target: THREE.Vector3,
  planViewLocked: boolean,
): number {
  if (planViewLocked) return 0;
  const e = new THREE.Vector3(0, 0, 1);
  camera.updateMatrixWorld(true);
  e.applyMatrix4(camera.matrixWorldInverse);
  const len = Math.hypot(e.x, e.y);
  if (len < 1e-6) return 0;
  return (Math.atan2(e.x, -e.y) * 180) / Math.PI;
}
