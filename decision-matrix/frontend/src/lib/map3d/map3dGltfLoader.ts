import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MAP3D_OBJECT_SCALE } from './map3dConfig';
import { gltfAssetDef } from './map3dGltfAssets';
import {
  buildObjectColorPalette,
  paletteRoleForMesh,
  type Map3dObjectPalette,
} from './map3dObjectPalette';

const loader = new GLTFLoader();
const prototypeCache = new Map<string, Promise<THREE.Group>>();

const _worldPos = new THREE.Vector3();

function stripMaps(mat: THREE.MeshStandardMaterial): void {
  mat.map = null;
  mat.normalMap = null;
  mat.roughnessMap = null;
  mat.metalnessMap = null;
  mat.aoMap = null;
}

/** Height-based vertex colors + no Kenney atlas — visible multi-tone palette. */
function applyMeshVertexPalette(
  mesh: THREE.Mesh,
  groupBox: THREE.Box3,
  palette: Map3dObjectPalette,
  selected: boolean,
  meshIndex: number,
): void {
  const geom = mesh.geometry as THREE.BufferGeometry;
  const pos = geom.getAttribute('position');
  if (!pos || pos.count === 0) return;

  const height = Math.max(groupBox.max.y - groupBox.min.y, 0.001);
  const colors = new Float32Array(pos.count * 3);

  for (let i = 0; i < pos.count; i++) {
    _worldPos.fromBufferAttribute(pos as THREE.BufferAttribute, i);
    _worldPos.applyMatrix4(mesh.matrixWorld);
    const ny = THREE.MathUtils.clamp((_worldPos.y - groupBox.min.y) / height, 0, 1);
    const role = paletteRoleForMesh(mesh.name, ny, meshIndex + (i % 3));
    const c = palette[role];
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const setupMaterial = (m: THREE.Material): THREE.Material => {
    const mat = m.clone();
    if (mat instanceof THREE.MeshStandardMaterial) {
      stripMaps(mat);
      mat.vertexColors = true;
      mat.color.set('#ffffff');
      mat.emissive.set(selected ? '#ffffff' : '#000000');
      mat.emissiveIntensity = selected ? 0.18 : 0;
      mat.roughness = 0.72;
      mat.metalness = 0.05;
    } else if (mat instanceof THREE.MeshLambertMaterial) {
      mat.map = null;
      mat.vertexColors = true;
      mat.color.set('#ffffff');
    } else if (mat instanceof THREE.MeshBasicMaterial) {
      mat.map = null;
      mat.vertexColors = true;
      mat.color.set('#ffffff');
    }
    return mat;
  };

  if (Array.isArray(mesh.material)) {
    mesh.material = mesh.material.map(setupMaterial);
  } else {
    mesh.material = setupMaterial(mesh.material);
  }
}

export function applyGltfInstanceColor(
  group: THREE.Group,
  colorHex: string,
  selected: boolean,
): void {
  const palette = buildObjectColorPalette(colorHex);
  group.updateWorldMatrix(true, true);
  const groupBox = new THREE.Box3().setFromObject(group);
  let meshIndex = 0;

  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    applyMeshVertexPalette(mesh, groupBox, palette, selected, meshIndex++);
  });
}

function normalizePrototype(scene: THREE.Group, def: NonNullable<ReturnType<typeof gltfAssetDef>>): THREE.Group {
  const root = new THREE.Group();
  root.add(scene);

  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 0.001);
  const targetH = def.targetHeightM * MAP3D_OBJECT_SCALE;
  const s = targetH / maxDim;
  root.scale.setScalar(s);

  const box2 = new THREE.Box3().setFromObject(root);
  root.position.y = -box2.min.y;

  if (def.yawDeg) {
    root.rotation.y = (def.yawDeg * Math.PI) / 180;
  }

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      if (m && 'side' in m) (m as THREE.Material).side = THREE.FrontSide;
    }
  });

  return root;
}

export function loadGltfPrototype(assetId: string): Promise<THREE.Group> {
  const id = assetId.trim().toLowerCase();
  const def = gltfAssetDef(id);
  if (!def) return Promise.reject(new Error(`Unknown glTF asset: ${assetId}`));

  let pending = prototypeCache.get(id);
  if (!pending) {
    pending = loader.loadAsync(def.url).then((gltf) => normalizePrototype(gltf.scene, def));
    prototypeCache.set(id, pending);
  }
  return pending;
}

/** Instance-ready clone (normalized scale, layer color, sitting on Y=0). */
export async function cloneGltfModel(
  assetId: string,
  colorHex: string,
  selected = false,
): Promise<THREE.Group> {
  const proto = await loadGltfPrototype(assetId);
  const group = proto.clone(true);
  applyGltfInstanceColor(group, colorHex, selected);
  return group;
}

/** Clone and scale so the model's height matches `heightM` (scene meters, incl. MAP3D scales). */
export async function cloneGltfModelToHeight(
  assetId: string,
  colorHex: string,
  heightM: number,
  selected = false,
): Promise<THREE.Group> {
  const group = await cloneGltfModel(assetId, colorHex, selected);
  const box = new THREE.Box3().setFromObject(group);
  const h = Math.max(box.max.y - box.min.y, 0.001);
  group.scale.multiplyScalar(heightM / h);
  group.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(group);
  group.position.y -= box2.min.y;
  return group;
}

export function clearGltfPrototypeCache(): void {
  prototypeCache.clear();
}
