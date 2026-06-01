/**
 * Runtime registry for per-project custom GLB models (admin upload).
 * IDs use prefix `custom:{uuid}` in render_3d_model_id.
 */

import type { Map3dCustomModel } from '../api';
import type { Map3dGltfAssetDef } from './map3dGltfAssets';
import { gltfAssetDef } from './map3dGltfAssets';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

const customById = new Map<string, Map3dGltfAssetDef>();

export function customModelPropertyId(modelId: string): string {
  const id = modelId.trim();
  return id.toLowerCase().startsWith('custom:') ? id.toLowerCase() : `custom:${id}`;
}

function fileUrl(projectId: string, modelId: string): string {
  const base = API_BASE.endsWith('/') ? API_BASE.slice(0, -1) : API_BASE;
  return `${base}/projects/${projectId}/map3d-custom-models/${modelId}/file`;
}

export function setProjectCustomGltfAssets(projectId: string, models: Map3dCustomModel[]): void {
  customById.clear();
  for (const m of models) {
    const key = customModelPropertyId(m.id);
    customById.set(key, {
      url: fileUrl(projectId, m.id),
      targetHeightM: m.target_height_m,
    });
  }
}

export function getCustomGltfAssetDef(assetId: string): Map3dGltfAssetDef | null {
  return customById.get(assetId.trim().toLowerCase()) ?? null;
}

export function resolveGltfAssetDef(assetId: string): Map3dGltfAssetDef | null {
  const id = assetId.trim().toLowerCase();
  return getCustomGltfAssetDef(id) ?? gltfAssetDef(id);
}
