import maplibregl from 'maplibre-gl';
import * as THREE from 'three';
import { resolveLine3dVisualStyle } from './map3dLineStyle';

function hexToThreeColor(hex: string): THREE.Color {
  try {
    return new THREE.Color(hex);
  } catch {
    return new THREE.Color('#666666');
  }
}

function pathLengthMeters(points: THREE.Vector3[]): number {
  let d = 0;
  for (let i = 1; i < points.length; i++) {
    d += points[i - 1]!.distanceTo(points[i]!);
  }
  return d;
}

function tubularSegmentCount(points: THREE.Vector3[]): number {
  const len = pathLengthMeters(points);
  return Math.max(12, Math.min(96, Math.ceil(len / 6)));
}

function vertexToLocalMeters(
  anchor: maplibregl.MercatorCoordinate,
  lon: number,
  lat: number,
  altM: number,
): THREE.Vector3 {
  const mc = maplibregl.MercatorCoordinate.fromLngLat([lon, lat], altM);
  const m = anchor.meterInMercatorCoordinateUnits();
  return new THREE.Vector3((mc.x - anchor.x) / m, (mc.z - anchor.z) / m, -(mc.y - anchor.y) / m);
}

function buildCurve(points: THREE.Vector3[]): THREE.Curve<THREE.Vector3> {
  if (points.length === 2) {
    return new THREE.LineCurve3(points[0]!, points[1]!);
  }
  return new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.35);
}

export type LineTubeBuildInput = {
  path: [number, number][];
  alts: number[];
  radiusM: number;
  colorHex: string;
  opacity: number;
  subtype: string;
  selected: boolean;
};

/** Single flat-colored tube — no lights, outline, or caps (avoids edge artifacts). */
export function createLineTubeGroup(
  input: LineTubeBuildInput,
): { group: THREE.Group; anchorLon: number; anchorLat: number; anchorAlt: number } | null {
  const { path, alts, radiusM, colorHex, opacity, subtype, selected } = input;
  if (path.length < 2) return null;

  const style = resolveLine3dVisualStyle(subtype, selected);
  const anchorLon = path[0]![0];
  const anchorLat = path[0]![1];
  const anchorAlt = alts[0] ?? 0;
  const anchor = maplibregl.MercatorCoordinate.fromLngLat([anchorLon, anchorLat], anchorAlt);

  const points = path.map((p, i) =>
    vertexToLocalMeters(anchor, p[0], p[1], alts[i] ?? anchorAlt),
  );
  if (points.length < 2) return null;

  const curve = buildCurve(points);
  const segments = tubularSegmentCount(points);
  const radius = radiusM * style.radiusMul;
  const color = hexToThreeColor(colorHex);
  if (selected) {
    color.lerp(new THREE.Color('#ffffff'), 0.12);
  }

  const alpha = Math.max(0.55, opacity);
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: alpha < 1,
    opacity: alpha,
    side: THREE.DoubleSide,
    depthWrite: true,
    depthTest: true,
  });

  const geom = new THREE.TubeGeometry(
    curve,
    segments,
    radius,
    style.radialSegments,
    false,
  );
  const mesh = new THREE.Mesh(geom, mat);
  const group = new THREE.Group();
  group.add(mesh);

  return { group, anchorLon, anchorLat, anchorAlt };
}
