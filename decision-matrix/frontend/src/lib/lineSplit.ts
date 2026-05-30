import type { InfraObject, InfraObjectCreate } from './api';
import { roundCoord } from './coords';
import { getLineCoordinates, isLineSubtype } from './infraGeometry';

/** Минимальное расстояние от конца линии, чтобы вставка не дублировала вершину (≈10 м). */
export const LINE_SPLIT_ENDPOINT_MIN_KM = 0.01;

/** Максимальное расстояние клика от линии для разрезания (≈300 м, как snap линий). */
export const LINE_SPLIT_HIT_TOLERANCE_KM = 0.3;

function haversineKm(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const r = 6371.0;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export type ClosestPointOnSegment = {
  point: [number, number];
  /** Параметр интерполяции 0..1 на отрезке. */
  t: number;
  distanceKm: number;
  segmentIndex: number;
};

/** Ближайшая точка на отрезке a–b к p (локальная интерполяция lon/lat). */
export function closestPointOnSegment(
  p: [number, number],
  a: [number, number],
  b: [number, number],
  segmentIndex: number,
): ClosestPointOnSegment {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  let t = len2 > 0 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const point: [number, number] = [a[0] + t * dx, a[1] + t * dy];
  return {
    point,
    t,
    distanceKm: haversineKm(p[0], p[1], point[0], point[1]),
    segmentIndex,
  };
}

export function closestPointOnPolyline(
  p: [number, number],
  coords: number[][],
  options?: { minFromEndpointKm?: number },
): ClosestPointOnSegment | null {
  if (coords.length < 2) return null;
  const minFromEndpoint = options?.minFromEndpointKm ?? LINE_SPLIT_ENDPOINT_MIN_KM;

  let best: ClosestPointOnSegment | null = null;
  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i] as [number, number];
    const b = coords[i + 1] as [number, number];
    const hit = closestPointOnSegment(p, a, b, i);
    if (best == null || hit.distanceKm < best.distanceKm) best = hit;
  }
  if (!best) return null;

  const start = coords[0] as [number, number];
  const end = coords[coords.length - 1] as [number, number];
  const atLineStart =
    best.segmentIndex === 0 &&
    (best.t <= 1e-6 || haversineKm(best.point[0], best.point[1], start[0], start[1]) < minFromEndpoint);
  const atLineEnd =
    best.segmentIndex === coords.length - 2 &&
    (best.t >= 1 - 1e-6 || haversineKm(best.point[0], best.point[1], end[0], end[1]) < minFromEndpoint);
  if (atLineStart || atLineEnd) return null;

  return best;
}

export type LineSplitCandidate = {
  line: InfraObject;
  segmentIndex: number;
  snapLon: number;
  snapLat: number;
  distanceKm: number;
};

export function findLineSplitAtPoint(
  click: [number, number],
  infraObjects: InfraObject[],
  toleranceKm = LINE_SPLIT_HIT_TOLERANCE_KM,
): LineSplitCandidate | null {
  let best: LineSplitCandidate | null = null;

  for (const obj of infraObjects) {
    if (!isLineSubtype(obj.subtype)) continue;
    const coords = getLineCoordinates(obj);
    if (!coords || coords.length < 2) continue;
    const hit = closestPointOnPolyline(click, coords);
    if (!hit || hit.distanceKm > toleranceKm) continue;
    const candidate: LineSplitCandidate = {
      line: obj,
      segmentIndex: hit.segmentIndex,
      snapLon: roundCoord(hit.point[0]),
      snapLat: roundCoord(hit.point[1]),
      distanceKm: hit.distanceKm,
    };
    if (!best || candidate.distanceKm < best.distanceKm) best = candidate;
  }

  return best;
}

export function splitLineCoordinatesAt(
  coords: number[][],
  segmentIndex: number,
  split: [number, number],
): [number[][], number[][]] | null {
  if (coords.length < 2) return null;
  if (segmentIndex < 0 || segmentIndex >= coords.length - 1) return null;

  const q: [number, number] = [roundCoord(split[0]), roundCoord(split[1])];
  const first: number[][] = [...coords.slice(0, segmentIndex + 1), q];
  const second: number[][] = [q, ...coords.slice(segmentIndex + 1)];

  if (first.length < 2 || second.length < 2) return null;
  return [first, second];
}

export function infraLineGeometryPayloadFromCoords(
  coords: number[][],
  template: InfraObject,
  name: string,
): Pick<
  InfraObjectCreate,
  'name' | 'subtype' | 'layer_id' | 'lon' | 'lat' | 'end_lon' | 'end_lat' | 'coordinates'
> {
  const rounded = coords.map(([lo, la]) => [roundCoord(lo), roundCoord(la)] as [number, number]);
  return {
    name,
    subtype: template.subtype,
    layer_id: template.layer_id,
    lon: rounded[0]![0],
    lat: rounded[0]![1],
    end_lon: rounded[rounded.length - 1]![0],
    end_lat: rounded[rounded.length - 1]![1],
    coordinates: rounded,
  };
}

export function infraLinePayloadFromCoords(
  coords: number[][],
  template: InfraObject,
  name: string,
): InfraObjectCreate {
  const base = infraLineGeometryPayloadFromCoords(coords, template, name);
  if (!template.properties) return base;
  const props = { ...template.properties };
  delete props.coordinates;
  return { ...base, properties: props };
}

export function buildLineSplitPlan(
  line: InfraObject,
  segmentIndex: number,
  splitLon: number,
  splitLat: number,
  secondLineName: string,
): {
  firstPayload: Pick<
    InfraObjectCreate,
    'name' | 'subtype' | 'layer_id' | 'lon' | 'lat' | 'end_lon' | 'end_lat' | 'coordinates'
  >;
  secondPayload: InfraObjectCreate;
} | null {
  const coords = getLineCoordinates(line);
  if (!coords) return null;
  const parts = splitLineCoordinatesAt(coords, segmentIndex, [splitLon, splitLat]);
  if (!parts) return null;
  const [firstCoords, secondCoords] = parts;
  return {
    firstPayload: infraLineGeometryPayloadFromCoords(firstCoords, line, line.name),
    secondPayload: infraLinePayloadFromCoords(secondCoords, line, secondLineName),
  };
}
