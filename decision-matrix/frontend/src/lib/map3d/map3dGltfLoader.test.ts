import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  anchorGltfGroupAtFootprint,
  applyGltfInstanceColor,
  applyGltfInstanceSelection,
} from './map3dGltfLoader';

describe('applyGltfInstanceColor', () => {
  it('writes height-based vertex colors and drops texture maps', () => {
    const group = new THREE.Group();
    const geom = new THREE.BoxGeometry(2, 4, 2);
    const mesh = new THREE.Mesh(
      geom,
      new THREE.MeshStandardMaterial({ color: '#888888' }),
    );
    mesh.position.y = 2;
    group.add(mesh);
    group.updateWorldMatrix(true, true);

    applyGltfInstanceColor(group, '#c62828', false);

    const out = group.children[0] as THREE.Mesh;
    const mat = out.material as THREE.MeshStandardMaterial;
    expect(mat.vertexColors).toBe(true);
    expect(mat.map).toBeNull();
    expect(out.geometry.getAttribute('color')).toBeTruthy();
    const colors = out.geometry.getAttribute('color') as THREE.BufferAttribute;
    expect(colors.count).toBeGreaterThan(0);
    expect(colors.getX(0)).not.toBe(colors.getX(colors.count - 1));
  });
});

describe('anchorGltfGroupAtFootprint', () => {
  it('re-centers XZ and grounds base after extra scale (height override)', () => {
    const root = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(4, 8, 4));
    mesh.position.set(12, 4, -6);
    root.add(mesh);
    root.scale.setScalar(1.5);
    anchorGltfGroupAtFootprint(root);
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    const center = box.getCenter(new THREE.Vector3());
    expect(Math.abs(center.x)).toBeLessThan(1e-4);
    expect(Math.abs(center.z)).toBeLessThan(1e-4);
    expect(box.min.y).toBeCloseTo(0, 4);
  });
});

describe('applyGltfInstanceSelection', () => {
  it('keeps texture maps and sets emissive when selected', () => {
    const tex = new THREE.Texture();
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ map: tex, color: '#ff0000' }),
    );
    group.add(mesh);

    applyGltfInstanceSelection(group, true);

    const out = group.children[0] as THREE.Mesh;
    const mat = out.material as THREE.MeshStandardMaterial;
    expect(mat.map).toBe(tex);
    expect(mat.vertexColors).not.toBe(true);
    expect(mat.emissiveIntensity).toBeGreaterThan(0);
    expect(out.geometry.getAttribute('color')).toBeFalsy();
  });
});
