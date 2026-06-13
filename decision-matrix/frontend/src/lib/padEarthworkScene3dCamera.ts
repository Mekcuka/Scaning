/** Orbit camera helpers for pad earthwork 3D preview. */

import * as THREE from 'three';

export type Scene3dCameraPreset = 'iso' | 'top' | 'front' | 'side';

export type Scene3dOrbitControlsLike = {
  target: THREE.Vector3;
  minDistance: number;
  maxDistance: number;
  update: () => void;
};

export const SCENE3D_ZOOM_STEP = 1.18;
export const SCENE3D_ORBIT_STEP_RAD = (15 * Math.PI) / 180;
export const SCENE3D_TILT_STEP_RAD = (12 * Math.PI) / 180;

const PRESET_DIRS: Record<Scene3dCameraPreset, THREE.Vector3> = {
  iso: new THREE.Vector3(0.85, 0.5, 0.85),
  top: new THREE.Vector3(0.02, 1, 0.02),
  front: new THREE.Vector3(0.12, 0.28, 1),
  side: new THREE.Vector3(1, 0.28, 0.12),
};

export function scene3dSceneBounds(root: THREE.Object3D): {
  center: THREE.Vector3;
  maxDim: number;
} | null {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  if (box.isEmpty()) return null;
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 0.001);
  return { center, maxDim };
}

export function scene3dFitDistance(
  camera: THREE.PerspectiveCamera,
  maxDim: number,
  margin = 1.35,
): number {
  const vFovRad = (camera.fov * Math.PI) / 180;
  const distV = (margin * maxDim) / (2 * Math.tan(vFovRad / 2));
  const hFovRad = 2 * Math.atan(Math.tan(vFovRad / 2) * camera.aspect);
  const distH = (margin * maxDim) / (2 * Math.tan(hFovRad / 2));
  return Math.max(distV, distH, 2);
}

export function scene3dCameraDistance(
  camera: THREE.PerspectiveCamera,
  controls: Scene3dOrbitControlsLike,
): number {
  return camera.position.distanceTo(controls.target);
}

export function scene3dCameraZoomPercent(
  camera: THREE.PerspectiveCamera,
  controls: Scene3dOrbitControlsLike,
  baselineDistance: number | null,
): number {
  if (!baselineDistance || baselineDistance <= 0) return 100;
  const dist = scene3dCameraDistance(camera, controls);
  return Math.round((baselineDistance / Math.max(dist, 0.001)) * 100);
}

export function applyScene3dCameraDistanceLimits(
  camera: THREE.PerspectiveCamera,
  controls: Scene3dOrbitControlsLike,
  distance: number,
): number {
  controls.minDistance = distance * 0.12;
  controls.maxDistance = distance * 10;
  camera.near = Math.max(distance / 200, 0.05);
  camera.far = Math.max(distance * 80, 500);
  camera.updateProjectionMatrix();
  return distance;
}

export function applyScene3dCameraUp(
  camera: THREE.PerspectiveCamera,
  preset: Scene3dCameraPreset | null,
): void {
  if (preset === 'top') {
    camera.up.set(0, 0, 1);
  } else {
    camera.up.set(0, 1, 0);
  }
}

/** True when the camera looks nearly straight down/up (plan-like orbit). */
export function isPlanViewCamera(camera: THREE.PerspectiveCamera, target: THREE.Vector3): boolean {
  const dx = camera.position.x - target.x;
  const dy = camera.position.y - target.y;
  const dz = camera.position.z - target.z;
  const horiz = Math.hypot(dx, dz);
  return Math.abs(dy) > Math.max(horiz * 1.8, 4);
}

/** Lock north (+Z) to screen up — matches 2D sketch (SVG y = −north). */
export function syncTopDownPlanCamera(
  camera: THREE.PerspectiveCamera,
  target: THREE.Vector3,
): void {
  camera.up.set(0, 0, 1);
  camera.lookAt(target);
}

export function shouldSyncPlanCamera(
  camera: THREE.PerspectiveCamera,
  target: THREE.Vector3,
  preset: Scene3dCameraPreset | null,
): boolean {
  return preset === 'top' || isPlanViewCamera(camera, target);
}

export function frameScene3dCamera(
  camera: THREE.PerspectiveCamera,
  controls: Scene3dOrbitControlsLike,
  root: THREE.Object3D,
  margin = 1.35,
  preset: Scene3dCameraPreset = 'iso',
): number | null {
  const bounds = scene3dSceneBounds(root);
  if (!bounds) return null;

  const distance = scene3dFitDistance(camera, bounds.maxDim, margin);
  applyScene3dCameraDistanceLimits(camera, controls, distance);

  const dir = PRESET_DIRS[preset].clone().normalize();
  applyScene3dCameraUp(camera, preset);
  camera.position.copy(bounds.center).add(dir.multiplyScalar(distance));
  controls.target.copy(bounds.center);
  if (preset === 'top') {
    syncTopDownPlanCamera(camera, controls.target);
  }
  controls.update();
  if (preset === 'top') {
    syncTopDownPlanCamera(camera, controls.target);
  }
  return distance;
}

export function setScene3dCameraPreset(
  camera: THREE.PerspectiveCamera,
  controls: Scene3dOrbitControlsLike,
  root: THREE.Object3D,
  preset: Scene3dCameraPreset,
  margin = 1.35,
): number | null {
  return frameScene3dCamera(camera, controls, root, margin, preset);
}

export function zoomScene3dCamera(
  camera: THREE.PerspectiveCamera,
  controls: Scene3dOrbitControlsLike,
  factor: number,
): void {
  const offset = camera.position.clone().sub(controls.target);
  const dist = offset.length();
  if (dist <= 0) return;
  const nextDist = THREE.MathUtils.clamp(dist * factor, controls.minDistance, controls.maxDistance);
  offset.multiplyScalar(nextDist / dist);
  camera.position.copy(controls.target).add(offset);
  controls.update();
}

export function scene3dToolbarZoomIn(
  camera: THREE.PerspectiveCamera,
  controls: Scene3dOrbitControlsLike,
): void {
  zoomScene3dCamera(camera, controls, 1 / SCENE3D_ZOOM_STEP);
}

export function scene3dToolbarZoomOut(
  camera: THREE.PerspectiveCamera,
  controls: Scene3dOrbitControlsLike,
): void {
  zoomScene3dCamera(camera, controls, SCENE3D_ZOOM_STEP);
}

export function orbitScene3dCamera(
  camera: THREE.PerspectiveCamera,
  controls: Scene3dOrbitControlsLike,
  deltaAzimuthRad: number,
  deltaPolarRad = 0,
): void {
  const offset = camera.position.clone().sub(controls.target);
  if (offset.lengthSq() <= 0) return;

  const spherical = new THREE.Spherical().setFromVector3(offset);
  spherical.theta += deltaAzimuthRad;
  spherical.phi = THREE.MathUtils.clamp(
    spherical.phi + deltaPolarRad,
    0.12,
    Math.PI - 0.12,
  );
  offset.setFromSpherical(spherical);
  camera.position.copy(controls.target).add(offset);
  camera.lookAt(controls.target);
  controls.update();
}
