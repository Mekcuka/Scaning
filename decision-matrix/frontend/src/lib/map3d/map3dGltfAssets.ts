/**
 * Bundled CC0 glTF assets (Kenney City Kit Industrial).
 * @see frontend/public/map3d-models/LICENSE-kenney.txt
 */
export type Map3dGltfAssetDef = {
  /** Path under site root (Vite public/). */
  url: string;
  /** Typical model height in meters before MAP3D_OBJECT_SCALE. */
  targetHeightM: number;
  /** Rotate model around local Y (degrees) if needed. */
  yawDeg?: number;
};

export const MAP3D_GLTF_ASSETS: Record<string, Map3dGltfAssetDef> = {
  'facility-large': {
    url: '/map3d-models/facility-large.glb',
    targetHeightM: 28,
  },
  'facility-medium': {
    url: '/map3d-models/facility-medium.glb',
    targetHeightM: 18,
  },
  'facility-compact': {
    url: '/map3d-models/facility-compact.glb',
    targetHeightM: 12,
  },
  substation: {
    url: '/map3d-models/substation.glb',
    targetHeightM: 16,
  },
  'stack-large': {
    url: '/map3d-models/stack-large.glb',
    targetHeightM: 35,
  },
  'stack-medium': {
    url: '/map3d-models/stack-medium.glb',
    targetHeightM: 22,
  },
  'stack-small': {
    url: '/map3d-models/stack-small.glb',
    targetHeightM: 14,
  },
  tank: {
    url: '/map3d-models/tank.glb',
    targetHeightM: 8,
  },
};

export function gltfAssetDef(assetId: string): Map3dGltfAssetDef | null {
  return MAP3D_GLTF_ASSETS[assetId.trim().toLowerCase()] ?? null;
}
