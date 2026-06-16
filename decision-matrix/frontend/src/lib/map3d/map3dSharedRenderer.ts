import type { Map as MapLibreMap } from 'maplibre-gl';
import * as THREE from 'three';
import { consumeMap3dRenderPasses, map3dDebugPassesEnabled } from './map3dRenderDebug';

/** Один Three.js renderer на карту — два custom-слоя на одном GL-контексте ломают WebGL в Electron/Cursor. */
const rendererByMap = new WeakMap<MapLibreMap, THREE.WebGLRenderer>();
const refCountByMap = new WeakMap<MapLibreMap, number>();

export function acquireMap3dThreeRenderer(
  map: MapLibreMap,
  gl: WebGLRenderingContext | WebGL2RenderingContext,
): THREE.WebGLRenderer {
  let renderer = rendererByMap.get(map);
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({
      canvas: map.getCanvas(),
      context: gl,
      antialias: false,
    });
    renderer.autoClear = false;
    rendererByMap.set(map, renderer);
    refCountByMap.set(map, 0);
  }
  refCountByMap.set(map, (refCountByMap.get(map) ?? 0) + 1);
  return renderer;
}

export function releaseMap3dThreeRenderer(map: MapLibreMap): void {
  const count = (refCountByMap.get(map) ?? 1) - 1;
  if (count > 0) {
    refCountByMap.set(map, count);
    return;
  }
  refCountByMap.delete(map);
  const renderer = rendererByMap.get(map);
  if (renderer) {
    renderer.dispose();
    rendererByMap.delete(map);
  }
}

/** Сброс GL-состояния после Three.js — иначе MapLibre теряет extrusion/terrain (Electron). */
export function finishMap3dThreeFrame(renderer: THREE.WebGLRenderer): void {
  if (map3dDebugPassesEnabled()) {
    const passes = consumeMap3dRenderPasses();
    if (passes > 0) {
      console.debug('[map3d] Three.js render passes:', passes);
    }
  }
  renderer.resetState();
}
