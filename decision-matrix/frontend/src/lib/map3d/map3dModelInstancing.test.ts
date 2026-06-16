import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { mergePrototypeGeometries } from './map3dModelInstancing';

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
});
