import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { PyWellGeoPlotSegment } from './api/pywellgeoApi';
import { kbFromPad, stationToScenePoint } from './padClusteringScene3d';
import {
  buildPyWellGeoBranchLines,
  buildPyWellGeoNodeMarker,
  pyWellGeoEnuToScenePoint,
} from './padClusteringScene3dPyWellGeo';

describe('padClusteringScene3dPyWellGeo', () => {
  const kbM = kbFromPad(100, 2);

  it('pyWellGeoEnuToScenePoint matches welleng trajectory mapping', () => {
    const east = -70.96;
    const north = 99.96;
    const zPy = -617.11;
    expect(pyWellGeoEnuToScenePoint(east, north, zPy, kbM)).toEqual(
      stationToScenePoint(east, north, 617.11, kbM),
    );
  });

  it('buildPyWellGeoBranchLines places segment vertices in scene frame', () => {
    const segments: PyWellGeoPlotSegment[] = [
      {
        from_xyz: [0, 0, 0],
        to_xyz: [10, 20, -500],
        color: 'black',
        perforated: false,
        name: 'main',
      },
    ];
    const lines = buildPyWellGeoBranchLines(segments, kbM);
    const pos = lines.geometry.getAttribute('position');
    expect(pos.count).toBe(2);
    const p0 = stationToScenePoint(0, 0, 0, kbM);
    const p1 = stationToScenePoint(10, 20, 500, kbM);
    expect(pos.getX(0)).toBeCloseTo(p0.x);
    expect(pos.getY(0)).toBeCloseTo(p0.y);
    expect(pos.getZ(0)).toBeCloseTo(p0.z);
    expect(pos.getX(1)).toBeCloseTo(p1.x);
    expect(pos.getY(1)).toBeCloseTo(p1.y);
    expect(pos.getZ(1)).toBeCloseTo(p1.z);
  });

  it('buildPyWellGeoNodeMarker places sphere at node ENU', () => {
    const marker = buildPyWellGeoNodeMarker({ x: 10, y: 20, z: -500, color: 'orange' }, kbM);
    const sphere = marker.children[0] as THREE.Mesh;
    const p = stationToScenePoint(10, 20, 500, kbM);
    expect(sphere.position.x).toBeCloseTo(p.x);
    expect(sphere.position.y).toBeCloseTo(p.y);
    expect(sphere.position.z).toBeCloseTo(p.z);
  });
});
