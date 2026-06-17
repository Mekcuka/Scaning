import * as THREE from 'three';
import type { PyWellGeoPlotSegment } from '../api/pywellgeoApi';
import { stationToScenePoint } from './padClusteringScene3d';

/** PyWellGeo node: x=east, y=north, z=−TVD → same scene frame as welleng trajectories. */
export function pyWellGeoEnuToScenePoint(
  eastM: number,
  northM: number,
  zPyWellGeo: number,
  kbM: number,
): { x: number; y: number; z: number } {
  return stationToScenePoint(eastM, northM, -zPyWellGeo, kbM);
}

const BRANCH_COLORS: Record<string, number> = {
  black: 0x111111,
  orange: 0xf97316,
  amber: 0xf59e0b,
  red: 0xef4444,
  grey: 0x9ca3af,
  gray: 0x9ca3af,
  blue: 0x3b82f6,
};

function colorFromName(name: string, perforated: boolean): number {
  if (perforated) return 0x2563eb;
  const key = name.toLowerCase();
  for (const [k, v] of Object.entries(BRANCH_COLORS)) {
    if (key.includes(k)) return v;
  }
  return BRANCH_COLORS[name.toLowerCase()] ?? 0x6366f1;
}

export function buildPyWellGeoBranchLines(
  segments: PyWellGeoPlotSegment[],
  kbM: number,
): THREE.LineSegments {
  if (segments.length === 0) {
    const geom = new THREE.BufferGeometry();
    return new THREE.LineSegments(geom, new THREE.LineBasicMaterial());
  }

  const positions: number[] = [];
  const colors: number[] = [];

  for (const seg of segments) {
    const [x0, y0, z0] = seg.from_xyz;
    const [x1, y1, z1] = seg.to_xyz;
    const p0 = pyWellGeoEnuToScenePoint(x0, y0, z0, kbM);
    const p1 = pyWellGeoEnuToScenePoint(x1, y1, z1, kbM);
    positions.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z);
    const c = new THREE.Color(colorFromName(seg.color, seg.perforated));
    colors.push(c.r, c.g, c.b, c.r, c.g, c.b);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const material = new THREE.LineBasicMaterial({ vertexColors: true, linewidth: 2 });
  const lines = new THREE.LineSegments(geometry, material);
  lines.name = 'layer-pywellgeo-branches';
  return lines;
}

export function mergePlotSegments(segmentsList: PyWellGeoPlotSegment[][]): PyWellGeoPlotSegment[] {
  return segmentsList.flat();
}

export type PyWellGeoSelectedNodeMarker = {
  x: number;
  y: number;
  z: number;
  color?: string;
};

export function buildPyWellGeoNodeMarker(
  node: PyWellGeoSelectedNodeMarker,
  kbM: number,
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'pywellgeo-node-marker';
  const p = pyWellGeoEnuToScenePoint(node.x, node.y, node.z, kbM);
  const color = colorFromName(node.color ?? 'orange', false);
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(4.5, 16, 12),
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.35,
    }),
  );
  sphere.position.set(p.x, p.y, p.z);
  group.add(sphere);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(6.2, 0.45, 8, 24),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.copy(sphere.position);
  group.add(ring);

  return group;
}
