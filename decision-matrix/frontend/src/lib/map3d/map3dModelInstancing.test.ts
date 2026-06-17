import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { applyGltfInstanceColor } from './map3dGltfLoader';
import {
  createInstancedMeshFromPrototype,
  mergePrototypeGeometries,
} from './map3dModelInstancing';

describe('map3dModelInstancing', () => {
  it('mergePrototypeGeometries combines all sub-meshes', () => {
    const root = new THREE.Group();
    const a = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1));
    a.position.set(0, 1, 0);
    const b = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    b.position.set(1, 0.5, 0);
    root.add(a, b);

    const merged = mergePrototypeGeometries(root);
    expect(merged).not.toBeNull();
    expect(merged!.getAttribute('position')!.count).toBeGreaterThan(
      (a.geometry as THREE.BufferGeometry).getAttribute('position')!.count,
    );
  });

  it('mergePrototypeGeometries keeps vertex colors after applyGltfInstanceColor', () => {
    const root = new THREE.Group();
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(2, 4, 2),
      new THREE.MeshStandardMaterial({ color: '#888888' }),
    );
    mesh.position.y = 2;
    root.add(mesh);
    root.updateWorldMatrix(true, true);
    applyGltfInstanceColor(root, '#c62828', false);

    const merged = mergePrototypeGeometries(root);
    expect(merged?.getAttribute('color')).toBeTruthy();
  });

  it('createInstancedMeshFromPrototype rejects geometry without vertex colors', () => {
    const root = new THREE.Group();
    root.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));
    const material = new THREE.MeshStandardMaterial({ vertexColors: true });
    expect(createInstancedMeshFromPrototype(root, 2, material)).toBeNull();
  });
});
