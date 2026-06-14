import type { Map as MapLibreMap } from 'maplibre-gl';
import { MAP3D_CLIP_FAR_M, MAP3D_CLIP_NEAR_M } from './map3dConfig';

type TransformWithClip = {
  overrideNearFarZ?: (nearZ: number, farZ: number) => void;
  clearNearFarZOverride?: () => void;
};

/**
 * MapLibre auto near/far only considers ~100 m below the camera — deep TD targets
 * (KB − TVD, often −2…−5 km) get clipped. Extend far plane for 3D well geometry.
 */
export function applyMap3dExtendedClipPlanes(map: MapLibreMap): void {
  const transform = map.transform as TransformWithClip | undefined;
  if (!transform || typeof transform.overrideNearFarZ !== 'function') return;
  const nearZ = Math.max(MAP3D_CLIP_NEAR_M, map.getCanvas().height / 50);
  transform.overrideNearFarZ(nearZ, MAP3D_CLIP_FAR_M);
}

export function clearMap3dExtendedClipPlanes(map: MapLibreMap): void {
  const transform = map.transform as TransformWithClip | undefined;
  transform?.clearNearFarZOverride?.();
}
