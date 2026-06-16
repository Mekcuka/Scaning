import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { isCustomGltfAssetId } from './map3dCustomAssets';
import { shouldRenderPointAsPowerLineTower } from './map3dPowerLineNodeModel';
import type { Map3dModelInstance } from './map3dModelInstances';
import { effectiveRender3dHeightM } from './render3d';

export type InstancingBucket = {
  key: string;
  instances: Map3dModelInstance[];
};

/** Group bundled GLTF instances with same asset, color and height bucket. */
export function groupInstancesForInstancing(
  instances: Map3dModelInstance[],
  options?: { enabled?: boolean },
): {
  buckets: InstancingBucket[];
  individual: Map3dModelInstance[];
} {
  if (options?.enabled === false) {
    return { buckets: [], individual: [...instances] };
  }
  const bucketMap = new Map<string, Map3dModelInstance[]>();
  const individual: Map3dModelInstance[] = [];

  for (const inst of instances) {
    const assetId = inst.catalog.gltfAssetId;
    if (!assetId || isCustomGltfAssetId(assetId) || shouldRenderPointAsPowerLineTower(inst.subtype)) {
      individual.push(inst);
      continue;
    }
    const heightM = effectiveRender3dHeightM({
      heightM: inst.heightM,
      baseM: inst.baseM,
      visible: true,
      scale: inst.scale,
    });
    const heightBucket = Math.round(heightM / 5) * 5;
    const key = `${assetId}:${inst.color.toLowerCase()}:${heightBucket}`;
    const list = bucketMap.get(key) ?? [];
    list.push(inst);
    bucketMap.set(key, list);
  }

  const buckets: InstancingBucket[] = [];
  for (const [key, list] of bucketMap) {
    if (list.length >= 2) buckets.push({ key, instances: list });
    else individual.push(...list);
  }

  return { buckets, individual };
}

export function mergePrototypeGeometries(prototype: THREE.Group): THREE.BufferGeometry | null {
  prototype.updateMatrixWorld(true);
  const parts: THREE.BufferGeometry[] = [];
  prototype.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const g = mesh.geometry.clone();
    g.applyMatrix4(mesh.matrixWorld);
    parts.push(g);
  });
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0]!;
  return mergeGeometries(parts, false);
}

export function createInstancedMeshFromPrototype(
  prototype: THREE.Group,
  count: number,
  material: THREE.Material,
): THREE.InstancedMesh | null {
  const geometry = mergePrototypeGeometries(prototype);
  if (!geometry || count < 1) return null;
  const instanced = new THREE.InstancedMesh(geometry, material, count);
  instanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  return instanced;
}

export function setInstancedMatrixAt(
  mesh: THREE.InstancedMesh,
  index: number,
  matrix: THREE.Matrix4,
): void {
  mesh.setMatrixAt(index, matrix);
  mesh.instanceMatrix.needsUpdate = true;
}

export function disposeInstancedMesh(mesh: THREE.InstancedMesh): void {
  mesh.geometry.dispose();
  if (Array.isArray(mesh.material)) mesh.material.forEach((m) => m.dispose());
  else mesh.material.dispose();
}
