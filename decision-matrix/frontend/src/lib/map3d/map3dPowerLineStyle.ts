import * as THREE from 'three';
import { anchorGltfGroupAtFootprint, loadGltfPrototype } from './map3dGltfLoader';

export const POWER_LINE_TOWER_GLTF_ID = 'transmission-tower';

/** Steel lattice body. */
export const POWER_LINE_METAL_COLOR = '#7b8e9a';
/** Insulators / upper crossarms / wires highlight. */
export const POWER_LINE_GLOW_COLOR = '#3dff7a';

const _worldPos = new THREE.Vector3();

export function createPowerLineMetalMaterial(selected: boolean): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: POWER_LINE_METAL_COLOR,
    metalness: 0.88,
    roughness: 0.32,
    emissive: new THREE.Color('#0d1a12'),
    emissiveIntensity: selected ? 0.14 : 0.06,
  });
}

export function createPowerLineGlowMaterial(selected: boolean): THREE.MeshStandardMaterial {
  const glow = new THREE.Color(POWER_LINE_GLOW_COLOR);
  return new THREE.MeshStandardMaterial({
    color: glow.clone().lerp(new THREE.Color(POWER_LINE_METAL_COLOR), 0.35),
    metalness: 0.55,
    roughness: 0.4,
    emissive: glow,
    emissiveIntensity: selected ? 1.05 : 0.62,
  });
}

export function createPowerLineWireMaterial(
  opacity: number,
  selected: boolean,
): THREE.MeshStandardMaterial {
  const glow = new THREE.Color(POWER_LINE_GLOW_COLOR);
  return new THREE.MeshStandardMaterial({
    color: '#2a3238',
    metalness: 0.92,
    roughness: 0.22,
    emissive: glow,
    emissiveIntensity: selected ? 0.48 : 0.28,
    transparent: opacity < 1,
    opacity: Math.max(0.7, opacity),
  });
}

function disposeMaterial(mat: THREE.Material | THREE.Material[]): void {
  if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
  else mat.dispose();
}

/** Metallic tower + green emissive on upper geometry (glTF). */
export function applyPowerLineTowerGltfStyle(group: THREE.Group, selected: boolean): void {
  const metalMat = createPowerLineMetalMaterial(selected);
  const glowMat = createPowerLineGlowMaterial(selected);

  group.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(group);
  const height = Math.max(box.max.y - box.min.y, 0.001);

  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;

    mesh.getWorldPosition(_worldPos);
    const ny = THREE.MathUtils.clamp((_worldPos.y - box.min.y) / height, 0, 1);
    const name = mesh.name.toLowerCase();
    const useGlow =
      ny > 0.68 ||
      name.includes('insul') ||
      name.includes('cross') ||
      name.includes('arm') ||
      name.includes('wire');

    if (mesh.material) disposeMaterial(mesh.material);
    mesh.material = (useGlow ? glowMat : metalMat).clone();
    if (useGlow && ny > 0.82) {
      const m = mesh.material as THREE.MeshStandardMaterial;
      m.emissiveIntensity = selected ? 1.2 : 0.78;
    }
  });
}

export async function clonePowerLineTowerToHeight(
  heightM: number,
  selected = false,
): Promise<THREE.Group> {
  const proto = await loadGltfPrototype(POWER_LINE_TOWER_GLTF_ID);
  const group = proto.clone(true);
  applyPowerLineTowerGltfStyle(group, selected);

  const box = new THREE.Box3().setFromObject(group);
  const h = Math.max(box.max.y - box.min.y, 0.001);
  group.scale.multiplyScalar(heightM / h);
  anchorGltfGroupAtFootprint(group);
  return group;
}
