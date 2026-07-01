import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { PadDemPreview } from '../padEarthworkDemPreview';
import {
  buildEnvelopeBermRing,
  buildPadMesh,
  envelopeBermElevations,
  envelopeRingVertexCount,
  envelopeSideTriangleCount,
  fillTerrainElevations,
  padFootprintVertices,
  planEastToSceneX,
  terrainGridIndexCount,
  terrainGridVertexCount,
} from '../padEarthworkScene3d';
import {
  generatePadFromWells,
  localPlanCorners,
  type PlanRectangleSketch,
} from '../padEarthworkSketch';
import { syncTopDownPlanCamera } from '../padEarthworkScene3dCamera';

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
      const _ny = uz * vx - ux * vz;
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
      const _my = (ay + by + cyp) / 3;
      const mz = (az + bz + czp) / 3;
      const dx = mx - cx;
      const dz = mz - cz;
      const dot = nx * dx + nz * dz;
      if (Math.abs(ny) < 0.01 && Math.hypot(nx, nz) > 0.01 && dot > 0) outwardSides += 1;
    }
    expect(outwardSides).toBeGreaterThan(0);
  });

  function padTopFaceCorners(group: THREE.Group, refM: number, heightM: number) {
    const topY = refM + heightM;
    const unique = new Map<string, { x: number; z: number }>();
    group.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const pos = (obj.geometry as THREE.BufferGeometry).getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i += 1) {
        const v = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
        obj.localToWorld(v);
        if (Math.abs(v.y - topY) > 0.05) continue;
        const key = `${v.x.toFixed(3)},${v.z.toFixed(3)}`;
        unique.set(key, { x: v.x, z: v.z });
      }
    });
    return [...unique.values()];
  }

  function expectFootprintMatch(
    group: THREE.Group,
    expected: { east_m: number; north_m: number }[],
    refM: number,
    heightM: number,
  ) {
    const top = padTopFaceCorners(group, refM, heightM);
    expect(top.length).toBeGreaterThanOrEqual(expected.length);
    for (const corner of expected) {
      const hit = top.some(
        (p) => Math.abs(p.x - planEastToSceneX(corner.east_m)) < 0.05 && Math.abs(p.z - corner.north_m) < 0.05,
      );
      expect(hit, `missing corner east=${corner.east_m} north=${corner.north_m}`).toBe(true);
    }
  }

  it('buildPadMesh polygon top face matches footprint vertices (ENU)', () => {
    const generated = generatePadFromWells({
      wellCount: 4,
      wellsPerGroup: 4,
      wellSpacingM: 30,
      groupSpacingM: 10,
      margins: { leftM: 20, bottomM: 15, topM: 15, endM: 20 },
    });
    const refM = 200;
    const heightM = 2;
    const group = buildPadMesh(generated.sketch, refM, heightM);
    expectFootprintMatch(group, padFootprintVertices(generated.sketch), refM, heightM);
  });

  it('buildPadMesh rectangle top face matches localPlanCorners (ENU)', () => {
    const refM = 200;
    const heightM = 2;
    const group = buildPadMesh(rectangleSketch, refM, heightM);
    expectFootprintMatch(group, localPlanCorners(rectangleSketch), refM, heightM);
  });

  it('buildPadMesh rectangle at rotation 0 matches localPlanCorners', () => {
    const sketch: PlanRectangleSketch = {
      kind: 'plan_rectangle',
      length_m: 120,
      width_m: 80,
      rotation_deg: 0,
    };
    const refM = 200;
    const heightM = 2;
    const group = buildPadMesh(sketch, refM, heightM);
    expectFootprintMatch(group, localPlanCorners(sketch), refM, heightM);
  });

  it('buildPadMesh aligns with layout wells for clustering defaults', () => {
    const generated = generatePadFromWells({
      wellCount: 12,
      wellsPerGroup: 1,
      wellSpacingM: 9,
      groupSpacingM: 9,
      margins: { leftM: 27, bottomM: 43, topM: 15, endM: 70 },
      rotationDeg: 90,
    });
    const refM = 200;
    const heightM = 2;
    const group = buildPadMesh(generated.sketch, refM, heightM);
    expectFootprintMatch(group, padFootprintVertices(generated.sketch), refM, heightM);
  });

  it('buildEnvelopeBermRing stays within pad footprint horizontally', () => {
    const group = buildEnvelopeBermRing(rectangleSketch, 3, 200, 2)!;
    const padVerts = padFootprintVertices(rectangleSketch);
    const padBox = new THREE.Box3();
    for (const v of padVerts) {
      padBox.expandByPoint(new THREE.Vector3(planEastToSceneX(v.east_m), 0, v.north_m));
    }
    const bermBox = new THREE.Box3().setFromObject(group);
    expect(bermBox.min.x).toBeGreaterThanOrEqual(padBox.min.x - 0.01);
    expect(bermBox.max.x).toBeLessThanOrEqual(padBox.max.x + 0.01);
    expect(bermBox.min.z).toBeGreaterThanOrEqual(padBox.min.z - 0.01);
    expect(bermBox.max.z).toBeLessThanOrEqual(padBox.max.z + 0.01);
  });

  it('clustering defaults: well row is nearer north edge than south in plan camera', () => {
    const generated = generatePadFromWells({
      wellCount: 12,
      wellsPerGroup: 1,
      wellSpacingM: 9,
      groupSpacingM: 9,
      margins: { leftM: 27, bottomM: 43, topM: 15, endM: 70 },
      rotationDeg: 90,
    });
    const verts = padFootprintVertices(generated.sketch);
    const maxN = Math.max(...verts.map((v) => v.north_m));
    const minN = Math.min(...verts.map((v) => v.north_m));
    const wellN = generated.wellsLocal[0]!.north_m;
    expect(maxN - wellN).toBeLessThan(wellN - minN);

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 2000);
    camera.position.set(0, 150, 0);
    syncTopDownPlanCamera(camera, new THREE.Vector3(0, 0, 0));
    camera.updateMatrixWorld(true);
    const northEdge = new THREE.Vector3(0, 0, maxN);
    const southEdge = new THREE.Vector3(0, 0, minN);
    const wellPt = new THREE.Vector3(planEastToSceneX(generated.wellsLocal[0]!.east_m), 0, wellN);
    northEdge.project(camera);
    southEdge.project(camera);
    wellPt.project(camera);
    expect(northEdge.y).toBeGreaterThan(southEdge.y);
    expect(wellPt.y).toBeGreaterThan(southEdge.y);
    expect(northEdge.y).toBeGreaterThan(wellPt.y);
  });

  it('plan camera: increasing plan east appears rightward on screen (scene X = −east)', () => {
    const generated = generatePadFromWells({
      wellCount: 12,
      wellsPerGroup: 1,
      wellSpacingM: 9,
      groupSpacingM: 9,
      margins: { leftM: 27, bottomM: 43, topM: 15, endM: 70 },
      rotationDeg: 90,
    });
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 2000);
    camera.position.set(0, 150, 0);
    syncTopDownPlanCamera(camera, new THREE.Vector3(0, 0, 0));
    camera.updateMatrixWorld(true);
    const first = new THREE.Vector3(
      planEastToSceneX(generated.wellsLocal[0]!.east_m),
      0,
      generated.wellsLocal[0]!.north_m,
    );
    const last = new THREE.Vector3(
      planEastToSceneX(generated.wellsLocal[11]!.east_m),
      0,
      generated.wellsLocal[11]!.north_m,
    );
    first.project(camera);
    last.project(camera);
    expect(last.x).toBeGreaterThan(first.x);
    expect(generated.wellsLocal[11]!.east_m).toBeGreaterThan(generated.wellsLocal[0]!.east_m);
  });
});
