import type { InfraObject } from './api';
import { isLineSubtype } from './infraGeometry';

export const LINE_ENDPOINT_SNAP_TOLERANCE_KM = 0.3;

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

/** Nearest point infrastructure object (any non-line subtype). */
function nearestPointEndpoint(
  point: [number, number],
  infraObjects: InfraObject[],
): { object: InfraObject; distanceKm: number } | null {
  let best: InfraObject | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const obj of infraObjects) {
    if (isLineSubtype(obj.subtype)) continue;
    const d = haversineKm(point[0], point[1], obj.lon, obj.lat);
    if (d < bestDist) {
      bestDist = d;
      best = obj;
    }
  }
  if (!best) return null;
  return { object: best, distanceKm: bestDist };
}

export function snapLineEndpoint(
  _lineSubtype: string,
  _endpointKind: 'start' | 'finish',
  point: [number, number],
  infraObjects: InfraObject[],
): [number, number] {
  const nearest = nearestPointEndpoint(point, infraObjects);
  if (!nearest || nearest.distanceKm > LINE_ENDPOINT_SNAP_TOLERANCE_KM) return point;
  return [nearest.object.lon, nearest.object.lat];
}

/** Nearest point object for line endpoint (same rules as backend). */
export function nearestAllowedLineEndpoint(
  _lineSubtype: string,
  _endpointKind: 'start' | 'finish',
  point: [number, number],
  infraObjects: InfraObject[],
): { object: InfraObject; distanceKm: number } | null {
  return nearestPointEndpoint(point, infraObjects);
}

export function isLineEndpointSnapped(
  lineSubtype: string,
  endpointKind: 'start' | 'finish',
  point: [number, number],
  infraObjects: InfraObject[],
): boolean {
  const nearest = nearestAllowedLineEndpoint(lineSubtype, endpointKind, point, infraObjects);
  return nearest != null && nearest.distanceKm <= LINE_ENDPOINT_SNAP_TOLERANCE_KM;
}

export function lineEndpointAllowsNode(lineSubtype: string): boolean {
  return isLineSubtype(lineSubtype);
}

export type ResolvedLineEndpoint =
  | {
      ok: true;
      lon: number;
      lat: number;
      attachedTo?: InfraObject;
      createNode: boolean;
    }
  | { ok: false; message: string };

/** Snap to nearest point object, or create a connection node if none within tolerance. */
export function resolveLineEndpoint(
  lineSubtype: string,
  endpointKind: 'start' | 'finish',
  point: [number, number],
  infraObjects: InfraObject[],
): ResolvedLineEndpoint {
  const nearest = nearestAllowedLineEndpoint(lineSubtype, endpointKind, point, infraObjects);
  const tol = LINE_ENDPOINT_SNAP_TOLERANCE_KM;
  if (nearest && nearest.distanceKm <= tol) {
    return {
      ok: true,
      lon: nearest.object.lon,
      lat: nearest.object.lat,
      attachedTo: nearest.object,
      createNode: false,
    };
  }
  if (lineEndpointAllowsNode(lineSubtype)) {
    return { ok: true, lon: point[0], lat: point[1], createNode: true };
  }
  const hint = nearest
    ? `Ближайший: ${nearest.object.name}, ${nearest.distanceKm.toFixed(2)} км.`
    : 'Нет точечных объектов в проекте.';
  return {
    ok: false,
    message: `Точка «${endpointKind === 'start' ? 'начала' : 'конца'}» не привязана (допуск ${tol} км). ${hint}`,
  };
}
