import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MAP3D_OBJECT_SCALE } from './map3dConfig';
import { fetchProjectCustomGlbBlob, isProjectCustomGlbFileUrl } from './map3dCustomGlbFetch';
import { isCustomGltfAssetId, resolveGltfAssetDef } from './map3dCustomAssets';
import type { Map3dGltfAssetDef } from './map3dGltfAssets';
import {
  buildObjectColorPalette,
  paletteRoleForMesh,
  type Map3dObjectPalette,
} from './map3dObjectPalette';

const loader = new GLTFLoader();
loader.setWithCredentials(true);
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
loader.setDRACOLoader(dracoLoader);
const prototypeCache = new Map<string, Promise<THREE.Group>>();
/** Colored normalized template (assetId + colorHex) — height scale applied per instance clone. */
const coloredTemplateCache = new Map<string, Promise<THREE.Group>>();

function coloredTemplateKey(assetId: string, colorHex: string): string {
  return `${assetId.trim().toLowerCase()}:${colorHex.trim().toLowerCase()}`;
}

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

/** Keep glTF materials/maps; only selection highlight (custom uploads). */
export function applyGltfInstanceSelection(group: THREE.Group, selected: boolean): void {
  const tune = (m: THREE.Material): THREE.Material => {
    const mat = m.clone();
    if (mat instanceof THREE.MeshStandardMaterial) {
      mat.emissive.set(selected ? '#ffffff' : '#000000');
      mat.emissiveIntensity = selected ? 0.12 : 0;
    } else if (mat instanceof THREE.MeshLambertMaterial) {
      mat.emissive.set(selected ? '#ffffff' : '#000000');
      mat.emissiveIntensity = selected ? 0.1 : 0;
    }
    return mat;
  };

  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map(tune);
    } else {
      mesh.material = tune(mesh.material);
    }
  });
}

function applyGltfInstanceAppearance(
  group: THREE.Group,
  assetId: string,
  colorHex: string,
  selected: boolean,
): void {
  if (isCustomGltfAssetId(assetId)) {
    applyGltfInstanceSelection(group, selected);
    return;
  }
  applyGltfInstanceColor(group, colorHex, selected);
}

/** Footprint center on lon/lat (XZ=0), base on ground (Y=0) — MapLibre anchor point. */
export function anchorGltfGroupAtFootprint(group: THREE.Group): void {
  group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(group);
  const center = box.getCenter(new THREE.Vector3());
  group.position.x -= center.x;
  group.position.z -= center.z;
  group.position.y -= box.min.y;
}

function normalizePrototype(scene: THREE.Group, def: Map3dGltfAssetDef): THREE.Group {
  const root = new THREE.Group();
  root.add(scene);

  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 0.001);
  const targetH = def.targetHeightM * MAP3D_OBJECT_SCALE;
  const s = targetH / maxDim;
  root.scale.setScalar(s);

  anchorGltfGroupAtFootprint(root);

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

async function loadGltfSceneFromUrl(url: string): Promise<THREE.Group> {
  if (isProjectCustomGlbFileUrl(url)) {
    const blob = await fetchProjectCustomGlbBlob(url);
    const objectUrl = URL.createObjectURL(blob);
    try {
      const gltf = await loader.loadAsync(objectUrl);
      return gltf.scene;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }
  const gltf = await loader.loadAsync(url);
  return gltf.scene;
}

export function loadGltfPrototype(assetId: string): Promise<THREE.Group> {
  const id = assetId.trim().toLowerCase();
  const def = resolveGltfAssetDef(id);
  if (!def) return Promise.reject(new Error(`Unknown glTF asset: ${assetId}`));

  let pending = prototypeCache.get(id);
  if (!pending) {
    pending = loadGltfSceneFromUrl(def.url)
      .then((scene) => normalizePrototype(scene, def))
      .catch((err) => {
        prototypeCache.delete(id);
        throw err;
      });
    prototypeCache.set(id, pending);
  }
  return pending;
}

/** Cached colored clone at normalized prototype height (no per-instance height scale). */
export function loadColoredGltfTemplate(assetId: string, colorHex: string): Promise<THREE.Group> {
  const key = coloredTemplateKey(assetId, colorHex);
  let pending = coloredTemplateCache.get(key);
  if (!pending) {
    pending = loadGltfPrototype(assetId).then((proto) => {
      const group = proto.clone(true);
      applyGltfInstanceAppearance(group, assetId, colorHex, false);
      return group;
    }).catch((err) => {
      coloredTemplateCache.delete(key);
      throw err;
    });
    coloredTemplateCache.set(key, pending);
  }
  return pending;
}

/** Instance-ready clone (normalized scale; bundled assets use layer palette, custom GLB keeps textures). */
export async function cloneGltfModel(
  assetId: string,
  colorHex: string,
  selected = false,
): Promise<THREE.Group> {
  const group = (await loadColoredGltfTemplate(assetId, colorHex)).clone(true);
  if (selected) {
    applyGltfInstanceAppearance(group, assetId, colorHex, true);
  }
  return group;
}

/** Scale an already-normalized glTF group to the target scene height (meters). */
export function scaleGltfGroupToHeightM(group: THREE.Group, heightM: number): void {
  group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(group);
  const size = box.getSize(new THREE.Vector3());
  // Match normalizePrototype (max axis) — Y-only scaling breaks assets oriented along X/Z.
  const h = Math.max(size.x, size.y, size.z, 0.001);
  if (heightM > 0 && Number.isFinite(heightM)) {
    group.scale.multiplyScalar(heightM / h);
    anchorGltfGroupAtFootprint(group);
  }
}

/** Clone and scale so the model's height matches `heightM` (scene meters, incl. MAP3D scales). */
export async function cloneGltfModelToHeight(
  assetId: string,
  colorHex: string,
  heightM: number,
  selected = false,
): Promise<THREE.Group> {
  const group = await cloneGltfModel(assetId, colorHex, selected);
  scaleGltfGroupToHeightM(group, heightM);
  return group;
}

export function clearGltfPrototypeCache(): void {
  prototypeCache.clear();
  coloredTemplateCache.clear();
}
