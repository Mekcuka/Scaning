/** Pad footprint ENU → lon/lat (mirrors pad_earthwork/footprint.py + service resolve). */

import type { InfraObject } from './api';
import {
  DEFAULT_PAD_LENGTH_M,
  DEFAULT_PAD_NDS_DEG,
  DEFAULT_PAD_WIDTH_M,
  isEarthworkEligibleSubtype,
  padParamsFromObject,
  readNdsDegFromProperties,
} from './infraPadEarthwork';
import { parseSketchFromLast, type PlanShapeSketch } from './padEarthworkSketch';

export function metersPerDegree(latDeg: number): { lon: number; lat: number } {
  const latRad = (latDeg * Math.PI) / 180;
  return { lon: 111_320 * Math.cos(latRad), lat: 110_540 };
}

export function footprintCornersLonLat(
  lon: number,
  lat: number,
  lengthM: number,
  widthM: number,
  rotationDeg = 0,
): [number, number][] {
  const { lon: mPerDegLon, lat: mPerDegLat } = metersPerDegree(lat);
  const halfL = lengthM / 2;
  const halfW = widthM / 2;
  const local: [number, number][] = [
    [-halfL, -halfW],
    [halfL, -halfW],
    [halfL, halfW],
    [-halfL, halfW],
  ];
  const rot = (rotationDeg * Math.PI) / 180;
  const cosR = Math.cos(rot);
  const sinR = Math.sin(rot);
  return local.map(([eastM, northM]) => {
    const xr = eastM * cosR - northM * sinR;
    const yr = eastM * sinR + northM * cosR;
    return [lon + xr / mPerDegLon, lat + yr / mPerDegLat] as [number, number];
  });
}

export function footprintPolygonLonLat(
  lon: number,
  lat: number,
  vertices: { east_m: number; north_m: number }[],
): [number, number][] {
  const { lon: mPerDegLon, lat: mPerDegLat } = metersPerDegree(lat);
  return vertices.map(
    (v) => [lon + v.east_m / mPerDegLon, lat + v.north_m / mPerDegLat] as [number, number],
  );
}

function cornersFromSketch(
  lon: number,
  lat: number,
  sketch: PlanShapeSketch,
): [number, number][] {
  if (sketch.kind === 'plan_polygon') {
    return footprintPolygonLonLat(lon, lat, sketch.vertices);
  }
  return footprintCornersLonLat(lon, lat, sketch.length_m, sketch.width_m, sketch.rotation_deg);
}

function cornersFromParams(lon: number, lat: number, obj: InfraObject): [number, number][] {
  const p = padParamsFromObject(obj);
  const lengthM = Number(p.lengthM) || DEFAULT_PAD_LENGTH_M;
  const widthM = Number(p.widthM) || DEFAULT_PAD_WIDTH_M;
  const rawRot = Number(readNdsDegFromProperties(obj.properties));
  const rotationDeg = Number.isFinite(rawRot) ? rawRot : DEFAULT_PAD_NDS_DEG;
  return footprintCornersLonLat(lon, lat, lengthM, widthM, rotationDeg);
}

/** Closed ring [lon, lat][] for map polygon; null if not earthwork-eligible. */
export function resolveFootprintLonLat(obj: InfraObject): [number, number][] | null {
  if (!isEarthworkEligibleSubtype(obj.subtype)) return null;
  const lon = obj.lon;
  const lat = obj.lat;
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;

  const rawSketch = obj.properties?.pad_earthwork_sketch_json;
  const sketch = parseSketchFromLast(rawSketch);
  const corners = sketch ? cornersFromSketch(lon, lat, sketch) : cornersFromParams(lon, lat, obj);
  if (corners.length < 3) return null;
  const first = corners[0]!;
  const last = corners[corners.length - 1]!;
  if (first[0] !== last[0] || first[1] !== last[1]) {
    return [...corners, first];
  }
  return corners;
}
