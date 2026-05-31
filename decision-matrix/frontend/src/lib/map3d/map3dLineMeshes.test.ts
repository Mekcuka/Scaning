import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createLineTubeGroup } from './map3dLineMeshes';

describe('createLineTubeGroup', () => {
  it('uses straight segments (midpoint on chord, not Catmull bulge)', () => {
    const path: [number, number][] = [
      [37.6, 55.75],
      [37.62, 55.74],
      [37.64, 55.76],
    ];
    const built = createLineTubeGroup({
      path,
      alts: [0, 0, 0],
      radiusM: 2,
      colorHex: '#8b4513',
      opacity: 1,
      subtype: 'additional_line',
      selected: false,
    });
    expect(built).not.toBeNull();
    const mesh = built!.group.children[0] as THREE.Mesh;
    const geom = mesh.geometry as THREE.TubeGeometry;
    const params = geom.parameters as { path: THREE.Curve<THREE.Vector3> };
    const curvePath = params.path as THREE.CurvePath<THREE.Vector3>;
    expect(curvePath.curves).toHaveLength(path.length - 1);
    for (const seg of curvePath.curves) {
      expect(seg).toBeInstanceOf(THREE.LineCurve3);
    }
    const middleSeg = curvePath.curves[1] as THREE.LineCurve3;
    const midOnSeg = middleSeg.getPoint(0.5);
    const segMid = middleSeg.v1.clone().add(middleSeg.v2).multiplyScalar(0.5);
    expect(midOnSeg.distanceTo(segMid)).toBeLessThan(1e-6);
  });
});
