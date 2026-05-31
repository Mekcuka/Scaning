import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { applyGltfInstanceColor } from './map3dGltfLoader';

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
