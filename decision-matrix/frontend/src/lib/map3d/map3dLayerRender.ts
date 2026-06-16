import * as THREE from 'three';
import { map3dDebugPassesEnabled, noteMap3dRenderPass } from './map3dRenderDebug';

export type Map3dDepthPass = 'opaque' | 'overlay';

export type Map3dRenderItem = {
  group: THREE.Object3D;
  localMatrix: THREE.Matrix4;
  renderOrder?: number;
  depthPass?: Map3dDepthPass;
};

export function applyInstanceMatrix(group: THREE.Object3D, localMatrix: THREE.Matrix4): void {
  group.matrix.copy(localMatrix);
  group.matrixAutoUpdate = false;
}

function prepareItems(items: Map3dRenderItem[], depthPass: Map3dDepthPass): Map3dRenderItem[] {
  return items.filter((item) => (item.depthPass ?? 'opaque') === depthPass);
}

function renderPass(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  projMatrix: THREE.Matrix4,
  items: Map3dRenderItem[],
  clearDepth: boolean,
): void {
  if (items.length === 0) return;

  camera.projectionMatrix.copy(projMatrix);

  for (const item of items) {
    applyInstanceMatrix(item.group, item.localMatrix);
    if (item.renderOrder != null) item.group.renderOrder = item.renderOrder;
    item.group.visible = true;
  }

  for (const child of scene.children) {
    // Lights must stay visible — MeshStandardMaterial renders black without them.
    if ((child as THREE.Light).isLight) continue;
    if (!items.some((item) => item.group === child)) {
      child.visible = false;
    }
  }

  scene.updateMatrixWorld(true);
  renderer.resetState();
  if (clearDepth && (items[0]?.depthPass ?? 'opaque') === 'opaque') {
    renderer.clearDepth();
  }
  renderer.render(scene, camera);
  if (map3dDebugPassesEnabled()) noteMap3dRenderPass();
}

export type Map3dRenderOptions = {
  /** When false, keep prior depth (stack Three.js layers without z-fighting). Default true. */
  clearDepth?: boolean;
};

/** Single-pass (or dual-pass for overlay/no-depth groups) MapLibre+Three render. */
export function renderMap3dSceneOnce(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  projMatrix: THREE.Matrix4,
  items: Map3dRenderItem[],
  options: Map3dRenderOptions = {},
): void {
  const opaque = prepareItems(items, 'opaque');
  const overlay = prepareItems(items, 'overlay');
  const clearDepth = options.clearDepth !== false;
  renderPass(renderer, scene, camera, projMatrix, opaque, clearDepth);
  renderPass(renderer, scene, camera, projMatrix, overlay, clearDepth);

  for (const child of scene.children) {
    child.visible = true;
  }
}
