/**
 * Bundled CC0 glTF assets (Kenney City Kit Industrial).
 * @see frontend/public/map3d-models/LICENSE-kenney.txt
 */
import { map3dPublicUrl } from './map3dConfig';

export type Map3dGltfAssetDef = {
  /** Absolute URL under Vite base (GitHub Pages: /Repo/map3d-models/...). */
  url: string;
  /** Typical model height in meters before MAP3D_OBJECT_SCALE. */
  targetHeightM: number;
  /** Rotate model around local Y (degrees) if needed. */
  yawDeg?: number;
};

function gltf(path: string, targetHeightM: number, yawDeg?: number): Map3dGltfAssetDef {
  return { url: map3dPublicUrl(`map3d-models/${path}`), targetHeightM, yawDeg };
}

export const MAP3D_GLTF_ASSETS: Record<string, Map3dGltfAssetDef> = {
  'facility-large': gltf('facility-large.glb', 28),
  'facility-medium': gltf('facility-medium.glb', 18),
  'facility-compact': gltf('facility-compact.glb', 12),
  substation: gltf('substation.glb', 16),
  'stack-large': gltf('stack-large.glb', 35),
  'stack-medium': gltf('stack-medium.glb', 22),
  'stack-small': gltf('stack-small.glb', 14),
  tank: gltf('tank.glb', 8),
  /** Poly by Google (CC BY) — куст / станок-качалка. */
  'oil-pump-jack': gltf('oil-pump-jack.glb', 8),
  /** iPoly3D Lowpoly Electric Towers (CC0), Tower_1 — ЛЭП intermediate supports. */
  'transmission-tower': gltf('transmission-tower.glb', 10, 0),
};

export function gltfAssetDef(assetId: string): Map3dGltfAssetDef | null {
  return MAP3D_GLTF_ASSETS[assetId.trim().toLowerCase()] ?? null;
}
