import { describe, expect, it, afterEach } from 'vitest';
import * as THREE from 'three';
import {
  clearProceduralModelMeshCache,
  createProceduralModelMesh,
} from '../map3dModelMeshes';

afterEach(() => clearProceduralModelMeshCache());

describe('createProceduralModelMesh', () => {
  it('builds multi-part facility mesh', () => {
    const g = createProceduralModelMesh('facility', 24, 1.2, '#4a7c59');
    expect(g.children.length).toBeGreaterThanOrEqual(4);
  });

  it('reuses cache for identical params', () => {
    const a = createProceduralModelMesh('node', 12, 1, '#336699');
    const b = createProceduralModelMesh('node', 12, 1, '#336699');
    const ma = a.children[0] as THREE.Mesh;
    const mb = b.children[0] as THREE.Mesh;
    expect(ma.geometry).toBe(mb.geometry);
  });

  it('highlights selected instances', () => {
    const g = createProceduralModelMesh('facility', 20, 1, '#888888', true);
    const mesh = g.children[0] as THREE.Mesh;
    const mat = mesh.material as THREE.MeshStandardMaterial;
    expect(mat.emissiveIntensity).toBeGreaterThan(0.15);
  });
});
