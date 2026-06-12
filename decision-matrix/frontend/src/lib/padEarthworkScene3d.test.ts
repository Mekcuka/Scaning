import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { PadDemPreview } from './padEarthworkDemPreview';
import {
  buildEnvelopeBermRing,
  buildPadMesh,
  envelopeBermElevations,
  envelopeRingVertexCount,
  envelopeSideTriangleCount,
  fillTerrainElevations,
  padFootprintVertices,
  terrainGridIndexCount,
  terrainGridVertexCount,
} from './padEarthworkScene3d';
import type { PlanRectangleSketch } from './padEarthworkSketch';

const rectangleSketch: PlanRectangleSketch = {
  kind: 'plan_rectangle',
  length_m: 120,
  width_m: 80,
  rotation_deg: 15,
};

const samplePreview: PadDemPreview = {
  bounds: { min_east_m: -70, max_east_m: 70, min_north_m: -50, max_north_m: 50 },
  cols: 4,
  rows: 3,
  cell_size_m: 35,
  elev_min: 198,
  elev_max: 206,
  design_elevation_m: 202,
  elevations: [200, 201, null, 202, 203, 204, 205, 206, 199, 198, 200, 201],
  cut_fill: Array(12).fill(null),
};

describe('padEarthworkScene3d', () => {
  it('fillTerrainElevations replaces nodata with first finite fallback', () => {
    const filled = fillTerrainElevations(samplePreview.elevations, 4, 3);
    expect(filled.length).toBe(12);
    expect(filled[2]).toBe(200);
    expect(Number.isFinite(filled[2]!)).toBe(true);
  });

  it('terrain grid counts match cols × rows', () => {
    expect(terrainGridVertexCount(4, 3)).toBe(12);
    expect(terrainGridIndexCount(4, 3)).toBe(36);
    expect(terrainGridIndexCount(1, 1)).toBe(0);
  });

  it('padFootprintVertices returns four corners for rectangle', () => {
    const verts = padFootprintVertices(rectangleSketch);
    expect(verts).toHaveLength(4);
  });

  it('buildPadMesh positions prism between reference and top elevation', () => {
    const group = buildPadMesh(rectangleSketch, 200, 2);
    const box = new THREE.Box3().setFromObject(group);
    expect(box.min.y).toBeCloseTo(200, 4);
    expect(box.max.y).toBeCloseTo(202, 4);
  });

  it('envelopeRingVertexCount matches outer contour', () => {
    expect(envelopeRingVertexCount(rectangleSketch, 3)).toBe(4);
  });

  it('envelopeBermElevations places sole on pad top and crest at H = (W−TW)/2', () => {
    expect(envelopeBermElevations(200, 2, 3)).toEqual({ baseY: 202, crestY: 203 });
  });

  it('envelopeSideTriangleCount is two per edge', () => {
    expect(envelopeSideTriangleCount(4)).toBe(8);
  });

  it('buildEnvelopeBermRing spans pad top and crest', () => {
    const group = buildEnvelopeBermRing(rectangleSketch, 3, 200, 2);
    expect(group).not.toBeNull();
    const box = new THREE.Box3().setFromObject(group!);
    expect(box.min.y).toBeCloseTo(202, 4);
    expect(box.max.y).toBeCloseTo(203, 4);
  });

  it('buildEnvelopeBermRing is a single solid mesh without wireframe overlay', () => {
    const group = buildEnvelopeBermRing(rectangleSketch, 3, 200, 2)!;
    let meshCount = 0;
    let lineCount = 0;
    group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) meshCount += 1;
      if (obj instanceof THREE.LineSegments) lineCount += 1;
    });
    expect(meshCount).toBe(1);
    expect(lineCount).toBe(0);
  });

  it('inner slope faces point toward pad centroid', () => {
    const group = buildEnvelopeBermRing(rectangleSketch, 3, 200, 2)!;
    const mesh = group.children[0] as THREE.Mesh;
    const geom = mesh.geometry as THREE.BufferGeometry;
    const pos = geom.getAttribute('position') as THREE.BufferAttribute;
    const idx = geom.index!.array;
    const padVerts = padFootprintVertices(rectangleSketch);
    const cx = padVerts.reduce((s, v) => s + v.east_m, 0) / padVerts.length;
    const cz = padVerts.reduce((s, v) => s + v.north_m, 0) / padVerts.length;
    let innerFacing = 0;
    for (let t = 0; t < idx.length; t += 3) {
      const ia = idx[t]! * 3;
      const ib = idx[t + 1]! * 3;
      const ic = idx[t + 2]! * 3;
      const ax = pos.array[ia]!;
      const ay = pos.array[ia + 1]!;
      const az = pos.array[ia + 2]!;
      const bx = pos.array[ib]!;
      const by = pos.array[ib + 1]!;
      const bz = pos.array[ib + 2]!;
      const cxp = pos.array[ic]!;
      const cyp = pos.array[ic + 1]!;
      const czp = pos.array[ic + 2]!;
      const ux = bx - ax;
      const uy = by - ay;
      const uz = bz - az;
      const vx = cxp - ax;
      const vy = cyp - ay;
      const vz = czp - az;
      const nx = uy * vz - uz * vy;
      const ny = uz * vx - ux * vz;
      const nz = ux * vy - uy * vx;
      const mx = (ax + bx + cxp) / 3;
      const my = (ay + by + cyp) / 3;
      const mz = (az + bz + czp) / 3;
      const dx = cx - mx;
      const dz = cz - mz;
      const dot = nx * dx + nz * dz;
      if (my > 202.5 && Math.hypot(nx, nz) > 0.01 && dot > 0) innerFacing += 1;
    }
    expect(innerFacing).toBeGreaterThan(0);
  });

  it('buildPadMesh with berm inset keeps vertical extent and omits edge overlay', () => {
    const group = buildPadMesh(rectangleSketch, 200, 2, { bermWrapWidthM: 3 });
    const box = new THREE.Box3().setFromObject(group);
    expect(box.min.y).toBeCloseTo(200, 4);
    expect(box.max.y).toBeCloseTo(202, 4);
    let lineCount = 0;
    group.traverse((obj) => {
      if (obj instanceof THREE.LineSegments) lineCount += 1;
    });
    expect(lineCount).toBe(0);
  });

  it('buildPadMesh with berm has outward-facing side walls', () => {
    const group = buildPadMesh(rectangleSketch, 200, 2, { bermWrapWidthM: 3 });
    const mesh = group.children[0] as THREE.Mesh;
    const geom = mesh.geometry as THREE.BufferGeometry;
    const pos = geom.getAttribute('position') as THREE.BufferAttribute;
    const idx = geom.index!.array;
    const padVerts = padFootprintVertices(rectangleSketch);
    const cx = padVerts.reduce((s, v) => s + v.east_m, 0) / padVerts.length;
    const cz = padVerts.reduce((s, v) => s + v.north_m, 0) / padVerts.length;
    let outwardSides = 0;
    for (let t = 0; t < idx.length; t += 3) {
      const ia = idx[t]! * 3;
      const ib = idx[t + 1]! * 3;
      const ic = idx[t + 2]! * 3;
      const ax = pos.array[ia]!;
      const ay = pos.array[ia + 1]!;
      const az = pos.array[ia + 2]!;
      const bx = pos.array[ib]!;
      const by = pos.array[ib + 1]!;
      const bz = pos.array[ib + 2]!;
      const cxp = pos.array[ic]!;
      const cyp = pos.array[ic + 1]!;
      const czp = pos.array[ic + 2]!;
      const ux = bx - ax;
      const uy = by - ay;
      const uz = bz - az;
      const vx = cxp - ax;
      const vy = cyp - ay;
      const vz = czp - az;
      const nx = uy * vz - uz * vy;
      const ny = uz * vx - ux * vz;
      const nz = ux * vy - uy * vx;
      const mx = (ax + bx + cxp) / 3;
      const my = (ay + by + cyp) / 3;
      const mz = (az + bz + czp) / 3;
      const dx = mx - cx;
      const dz = mz - cz;
      const dot = nx * dx + nz * dz;
      if (Math.abs(ny) < 0.01 && Math.hypot(nx, nz) > 0.01 && dot > 0) outwardSides += 1;
    }
    expect(outwardSides).toBeGreaterThan(0);
  });

  it('buildEnvelopeBermRing stays within pad footprint horizontally', () => {
    const group = buildEnvelopeBermRing(rectangleSketch, 3, 200, 2)!;
    const padVerts = padFootprintVertices(rectangleSketch);
    const padBox = new THREE.Box3();
    for (const v of padVerts) {
      padBox.expandByPoint(new THREE.Vector3(v.east_m, 0, v.north_m));
    }
    const bermBox = new THREE.Box3().setFromObject(group);
    expect(bermBox.min.x).toBeGreaterThanOrEqual(padBox.min.x - 0.01);
    expect(bermBox.max.x).toBeLessThanOrEqual(padBox.max.x + 0.01);
    expect(bermBox.min.z).toBeGreaterThanOrEqual(padBox.min.z - 0.01);
    expect(bermBox.max.z).toBeLessThanOrEqual(padBox.max.z + 0.01);
  });
});
