/** Three.js scene builders for pad earthwork 3D preview (ENU: X=east, Y=up, Z=north). */

import * as THREE from 'three';
import {
  elevationRgb,
  type PadDemPreview,
  type PadDemPreviewBounds,
} from './padEarthworkDemPreview';
import {
  envelopeBermCrestInnerVertices,
  envelopeBermCrestOuterVertices,
  envelopeBermSoleInnerVertices,
  envelopeBermSoleOuterVertices,
  envelopeBermSlopeHeightM,
  envelopeOuterVertices,
  isPlanPolygon,
  isPlanRectangle,
  localPlanCorners,
  offsetPolygonInward,
  planVerticesCentroid,
  type PlanShapeSketch,
  type PlanVertex,
} from './padEarthworkSketch';
import { frameScene3dCamera } from './padEarthworkScene3dCamera';

export type Scene3dBounds = PadDemPreviewBounds;

export function fillTerrainElevations(
  elevations: (number | null)[],
  cols: number,
  rows: number,
): Float32Array {
  const out = new Float32Array(cols * rows);
  let fallback = 0;
  for (const v of elevations) {
    if (v != null && Number.isFinite(v)) {
      fallback = v;
      break;
    }
  }
  for (let i = 0; i < elevations.length; i++) {
    const v = elevations[i];
    out[i] = v != null && Number.isFinite(v) ? v : fallback;
  }
  return out;
}

export function padFootprintVertices(sketch: PlanShapeSketch): PlanVertex[] {
  if (isPlanPolygon(sketch)) return sketch.vertices;
  return localPlanCorners(sketch).map((c) => ({ east_m: c.east_m, north_m: c.north_m }));
}

export function terrainGridVertexCount(cols: number, rows: number): number {
  return cols * rows;
}

export function terrainGridIndexCount(cols: number, rows: number): number {
  if (cols < 2 || rows < 2) return 0;
  return (cols - 1) * (rows - 1) * 6;
}

export function envelopeRingVertexCount(sketch: PlanShapeSketch, wrapWidthM: number): number {
  return envelopeOuterVertices(sketch, wrapWidthM).length;
}

export function footprintSceneBounds(vertices: PlanVertex[], marginM = 24): Scene3dBounds {
  if (vertices.length === 0) {
    return { min_east_m: -marginM, max_east_m: marginM, min_north_m: -marginM, max_north_m: marginM };
  }
  let minE = vertices[0]!.east_m;
  let maxE = minE;
  let minN = vertices[0]!.north_m;
  let maxN = minN;
  for (const v of vertices) {
    minE = Math.min(minE, v.east_m);
    maxE = Math.max(maxE, v.east_m);
    minN = Math.min(minN, v.north_m);
    maxN = Math.max(maxN, v.north_m);
  }
  return {
    min_east_m: minE - marginM,
    max_east_m: maxE + marginM,
    min_north_m: minN - marginM,
    max_north_m: maxN + marginM,
  };
}

export function buildTerrainMesh(preview: PadDemPreview): THREE.Mesh {
  const { cols, rows, bounds, elevations, elev_min, elev_max, cell_size_m } = preview;
  const filled = fillTerrainElevations(elevations, cols, rows);
  const positions: number[] = [];
  const colors: number[] = [];

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const i = r * cols + c;
      const east = bounds.min_east_m + c * cell_size_m;
      const north = bounds.min_north_m + r * cell_size_m;
      const elev = filled[i]!;
      positions.push(east, elev, north);
      const [red, green, blue] = elevationRgb(elev, elev_min, elev_max);
      colors.push(red / 255, green / 255, blue / 255);
    }
  }

  const indices: number[] = [];
  for (let r = 0; r < rows - 1; r += 1) {
    for (let c = 0; c < cols - 1; c += 1) {
      const a = r * cols + c;
      const b = a + 1;
      const d = a + cols;
      const e = d + 1;
      indices.push(a, d, b, b, d, e);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.92,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  return new THREE.Mesh(geometry, material);
}

export type BuildPadMeshOptions = {
  /** Inset the top cap so the berm sole does not overlap the pad surface. */
  bermWrapWidthM?: number;
};

type Vec3 = [number, number, number];

function toVec3(v: PlanVertex, y: number): Vec3 {
  return [v.east_m, y, v.north_m];
}

function triNormal(a: Vec3, b: Vec3, c: Vec3): Vec3 {
  const ux = b[0] - a[0];
  const uy = b[1] - a[1];
  const uz = b[2] - a[2];
  const vx = c[0] - a[0];
  const vy = c[1] - a[1];
  const vz = c[2] - a[2];
  return [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
}

function pushQuadBuf(
  positions: number[],
  indices: number[],
  a: Vec3,
  b: Vec3,
  c: Vec3,
  d: Vec3,
) {
  const base = positions.length / 3;
  positions.push(...a, ...b, ...c, ...d);
  indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

function pushOrientedQuad(
  positions: number[],
  indices: number[],
  a: Vec3,
  b: Vec3,
  c: Vec3,
  d: Vec3,
  faceDir: Vec3,
) {
  const n = triNormal(a, b, c);
  const dot = n[0] * faceDir[0] + n[1] * faceDir[1] + n[2] * faceDir[2];
  if (dot >= 0) {
    pushQuadBuf(positions, indices, a, b, c, d);
  } else {
    pushQuadBuf(positions, indices, a, d, c, b);
  }
}

function pushOrientedTriangle(
  positions: number[],
  indices: number[],
  a: Vec3,
  b: Vec3,
  c: Vec3,
  faceDir: Vec3,
) {
  const n = triNormal(a, b, c);
  const dot = n[0] * faceDir[0] + n[1] * faceDir[1] + n[2] * faceDir[2];
  const base = positions.length / 3;
  if (dot >= 0) {
    positions.push(...a, ...b, ...c);
    indices.push(base, base + 1, base + 2);
  } else {
    positions.push(...a, ...c, ...b);
    indices.push(base, base + 1, base + 2);
  }
}

function buildPadGeometryWithBermGap(
  outerVerts: PlanVertex[],
  referenceM: number,
  heightM: number,
  bermWrapWidthM: number,
): THREE.BufferGeometry | null {
  const topVerts = offsetPolygonInward(outerVerts, bermWrapWidthM);
  if (outerVerts.length < 3 || topVerts.length < 3) return null;

  const baseY = referenceM + heightM;
  const centroid = planVerticesCentroid(outerVerts);
  const positions: number[] = [];
  const indices: number[] = [];
  const up: Vec3 = [0, 1, 0];
  const down: Vec3 = [0, -1, 0];

  for (let i = 0; i < outerVerts.length; i += 1) {
    const j = (i + 1) % outerVerts.length;
    const v0 = outerVerts[i]!;
    const v1 = outerVerts[j]!;
    const edgeMidEast = (v0.east_m + v1.east_m) / 2;
    const edgeMidNorth = (v0.north_m + v1.north_m) / 2;
    const outward: Vec3 = [
      edgeMidEast - centroid.east_m,
      0,
      edgeMidNorth - centroid.north_m,
    ];
    const bot0 = toVec3(v0, referenceM);
    const bot1 = toVec3(v1, referenceM);
    const top1 = toVec3(v1, baseY);
    const top0 = toVec3(v0, baseY);
    pushOrientedQuad(positions, indices, bot0, bot1, top1, top0, outward);
  }

  for (let i = 1; i < topVerts.length - 1; i += 1) {
    pushOrientedTriangle(
      positions,
      indices,
      toVec3(topVerts[0]!, baseY),
      toVec3(topVerts[i]!, baseY),
      toVec3(topVerts[i + 1]!, baseY),
      up,
    );
  }

  for (let i = 1; i < outerVerts.length - 1; i += 1) {
    pushOrientedTriangle(
      positions,
      indices,
      toVec3(outerVerts[0]!, referenceM),
      toVec3(outerVerts[i + 1]!, referenceM),
      toVec3(outerVerts[i]!, referenceM),
      down,
    );
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function buildPadMesh(
  sketch: PlanShapeSketch,
  referenceM: number,
  heightM: number,
  options: BuildPadMeshOptions = {},
): THREE.Group {
  const group = new THREE.Group();
  if (!Number.isFinite(referenceM) || !Number.isFinite(heightM) || heightM <= 0) return group;

  const bermWrapWidthM = options.bermWrapWidthM ?? 0;
  const fillMat = new THREE.MeshStandardMaterial({
    color: 0x3b82f6,
    transparent: true,
    opacity: 0.52,
    roughness: 0.65,
    metalness: 0.05,
    depthWrite: true,
    side: THREE.FrontSide,
  });
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x1d4ed8 });

  const outerVerts = padFootprintVertices(sketch);
  if (bermWrapWidthM > 0 && outerVerts.length >= 3) {
    const geometry = buildPadGeometryWithBermGap(outerVerts, referenceM, heightM, bermWrapWidthM);
    if (geometry) {
      const mesh = new THREE.Mesh(geometry, fillMat);
      mesh.renderOrder = 0;
      group.add(mesh);
      return group;
    }
  }

  if (isPlanRectangle(sketch)) {
    const geometry = new THREE.BoxGeometry(sketch.length_m, heightM, sketch.width_m);
    const mesh = new THREE.Mesh(geometry, fillMat);
    mesh.rotation.y = (sketch.rotation_deg * Math.PI) / 180;
    mesh.position.y = referenceM + heightM / 2;
    group.add(mesh);

    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), edgeMat);
    edges.rotation.copy(mesh.rotation);
    edges.position.copy(mesh.position);
    group.add(edges);
    return group;
  }

  if (outerVerts.length < 3) return group;

  const shape = new THREE.Shape();
  outerVerts.forEach((v, index) => {
    if (index === 0) shape.moveTo(v.east_m, -v.north_m);
    else shape.lineTo(v.east_m, -v.north_m);
  });
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, { depth: heightM, bevelEnabled: false });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, referenceM, 0);

  const mesh = new THREE.Mesh(geometry, fillMat);
  group.add(mesh);
  group.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry), edgeMat));
  return group;
}

export function envelopeBermElevations(
  referenceM: number,
  heightM: number,
  wrapWidthM: number,
): { baseY: number; crestY: number } {
  const baseY = referenceM + heightM;
  const bermH = envelopeBermSlopeHeightM(wrapWidthM);
  return { baseY, crestY: baseY + bermH };
}

/** @deprecated use envelopeBermElevations */
export function envelopeFrustumElevations(
  referenceM: number,
  heightM: number,
): { topY: number; bottomY: number } {
  const { baseY, crestY } = envelopeBermElevations(referenceM, heightM, 0);
  return { topY: crestY, bottomY: baseY };
}

export function envelopeSideTriangleCount(vertexCount: number): number {
  if (vertexCount < 3) return 0;
  return vertexCount * 2;
}

/** Sand berm ring on pad top: sole inset W from edge, both slopes rise inward 1:1. */
export function buildEnvelopeBermRing(
  sketch: PlanShapeSketch,
  wrapWidthM: number,
  referenceM: number,
  heightM: number,
): THREE.Group | null {
  if (wrapWidthM <= 0 || !Number.isFinite(referenceM) || !Number.isFinite(heightM) || heightM <= 0) {
    return null;
  }

  const innerVerts = envelopeBermSoleInnerVertices(sketch, wrapWidthM);
  const outerVerts = envelopeBermSoleOuterVertices(sketch);
  const innerCrestVerts = envelopeBermCrestInnerVertices(sketch, wrapWidthM);
  const outerCrestVerts = envelopeBermCrestOuterVertices(sketch, wrapWidthM);
  const n = innerVerts.length;
  if (n < 3 || outerVerts.length !== n || innerCrestVerts.length !== n || outerCrestVerts.length !== n) {
    return null;
  }

  const { baseY, crestY } = envelopeBermElevations(referenceM, heightM, wrapWidthM);
  const centroid = planVerticesCentroid(outerVerts);
  const group = new THREE.Group();
  group.renderOrder = 1;
  const bermMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    transparent: true,
    opacity: 0.55,
    roughness: 0.75,
    metalness: 0,
    side: THREE.FrontSide,
    depthWrite: true,
  });

  const positions: number[] = [];
  const indices: number[] = [];
  const up: Vec3 = [0, 1, 0];

  for (let i = 0; i < n; i += 1) {
    const j = (i + 1) % n;
    const in0 = innerVerts[i]!;
    const in1 = innerVerts[j]!;
    const out0 = outerVerts[i]!;
    const out1 = outerVerts[j]!;
    const ic0 = innerCrestVerts[i]!;
    const ic1 = innerCrestVerts[j]!;
    const oc0 = outerCrestVerts[i]!;
    const oc1 = outerCrestVerts[j]!;

    const edgeMidEast = (in0.east_m + in1.east_m) / 2;
    const edgeMidNorth = (in0.north_m + in1.north_m) / 2;
    const toCentroid: Vec3 = [
      centroid.east_m - edgeMidEast,
      0,
      centroid.north_m - edgeMidNorth,
    ];
    const fromCentroid: Vec3 = [-toCentroid[0], 0, -toCentroid[2]];

    const sole0 = toVec3(in0, baseY);
    const sole1 = toVec3(in1, baseY);
    const soleOut1 = toVec3(out1, baseY);
    const soleOut0 = toVec3(out0, baseY);
    pushOrientedQuad(positions, indices, sole0, sole1, soleOut1, soleOut0, up);

    const outerCrest1 = toVec3(oc1, crestY);
    const outerCrest0 = toVec3(oc0, crestY);
    pushOrientedQuad(
      positions,
      indices,
      soleOut0,
      soleOut1,
      outerCrest1,
      outerCrest0,
      fromCentroid,
    );

    const innerCrest1 = toVec3(ic1, crestY);
    const innerCrest0 = toVec3(ic0, crestY);
    pushOrientedQuad(positions, indices, sole0, sole1, innerCrest1, innerCrest0, toCentroid);

    pushOrientedQuad(
      positions,
      indices,
      innerCrest0,
      innerCrest1,
      outerCrest1,
      outerCrest0,
      up,
    );
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  group.add(new THREE.Mesh(geometry, bermMat));

  return group;
}

export function buildFlatGroundPlane(bounds: Scene3dBounds, referenceM: number): THREE.Mesh {
  const width = Math.max(bounds.max_east_m - bounds.min_east_m, 1);
  const depth = Math.max(bounds.max_north_m - bounds.min_north_m, 1);
  const cx = (bounds.min_east_m + bounds.max_east_m) / 2;
  const cz = (bounds.min_north_m + bounds.max_north_m) / 2;
  const geometry = new THREE.PlaneGeometry(width, depth, 1, 1);
  const material = new THREE.MeshStandardMaterial({
    color: 0x8fa882,
    roughness: 0.96,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(cx, referenceM, cz);
  return mesh;
}

/** Fit perspective camera so the whole scene root is visible. */
export function frameSceneInView(
  camera: THREE.PerspectiveCamera,
  controls: { target: THREE.Vector3; minDistance: number; maxDistance: number; update: () => void },
  root: THREE.Object3D,
  margin = 1.35,
): number | null {
  return frameScene3dCamera(camera, controls, root, margin, 'iso');
}

export function disposeObject3D(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.geometry?.dispose();
      if (Array.isArray(mesh.material)) mesh.material.forEach((m) => m.dispose());
      else mesh.material?.dispose();
    }
    const line = obj as THREE.Line | THREE.LineSegments | THREE.LineLoop;
    if (line.isLine || line.isLineSegments || line.isLineLoop) {
      line.geometry?.dispose();
      if (Array.isArray(line.material)) line.material.forEach((m) => m.dispose());
      else line.material?.dispose();
    }
  });
}
