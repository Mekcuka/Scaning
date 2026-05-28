import type { InfraObject } from './api';
import { isLineSubtype } from './infraGeometry';

export const LINE_ENDPOINT_SNAP_TOLERANCE_KM = 0.3;

const LINE_ENDPOINT_RULES: Record<string, { start: Set<string>; finish: Set<string> }> = {
  autoroad: {
    start: new Set(['node', 'gas_processing', 'gtes', 'substation', 'refinery']),
    finish: new Set(['node', 'gas_processing', 'gtes', 'substation', 'refinery']),
  },
  oil_pipeline: {
    start: new Set(['node', 'refinery']),
    finish: new Set(['node', 'refinery']),
  },
  gas_pipeline: {
    start: new Set(['node', 'gas_processing', 'gtes', 'refinery']),
    finish: new Set(['node', 'gas_processing', 'gtes', 'refinery']),
  },
  water_pipeline: {
    start: new Set(['node']),
    finish: new Set(['node']),
  },
  power_line: {
    start: new Set(['node', 'gas_processing', 'gtes', 'substation', 'refinery']),
    finish: new Set(['node', 'gas_processing', 'gtes', 'substation', 'refinery']),
  },
};

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

export function snapLineEndpoint(
  lineSubtype: string,
  endpointKind: 'start' | 'finish',
  point: [number, number],
  infraObjects: InfraObject[],
): [number, number] {
  if (!isLineSubtype(lineSubtype)) return point;
  const rule = LINE_ENDPOINT_RULES[lineSubtype];
  if (!rule) return point;
  const allowed = endpointKind === 'start' ? rule.start : rule.finish;
  let best: InfraObject | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const obj of infraObjects) {
    if (isLineSubtype(obj.subtype)) continue;
    if (!allowed.has(obj.subtype)) continue;
    const d = haversineKm(point[0], point[1], obj.lon, obj.lat);
    if (d < bestDist) {
      bestDist = d;
      best = obj;
    }
  }
  if (!best || bestDist > LINE_ENDPOINT_SNAP_TOLERANCE_KM) return point;
  return [best.lon, best.lat];
}

/** Nearest allowed point object for line endpoint (same rules as backend). */
export function nearestAllowedLineEndpoint(
  lineSubtype: string,
  endpointKind: 'start' | 'finish',
  point: [number, number],
  infraObjects: InfraObject[],
): { object: InfraObject; distanceKm: number } | null {
  if (!isLineSubtype(lineSubtype)) return null;
  const rule = LINE_ENDPOINT_RULES[lineSubtype];
  if (!rule) return null;
  const allowed = endpointKind === 'start' ? rule.start : rule.finish;
  let best: InfraObject | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const obj of infraObjects) {
    if (isLineSubtype(obj.subtype)) continue;
    if (!allowed.has(obj.subtype)) continue;
    const d = haversineKm(point[0], point[1], obj.lon, obj.lat);
    if (d < bestDist) {
      bestDist = d;
      best = obj;
    }
  }
  if (!best) return null;
  return { object: best, distanceKm: bestDist };
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

export function lineEndpointAllowsNode(
  lineSubtype: string,
  endpointKind: 'start' | 'finish',
): boolean {
  if (!isLineSubtype(lineSubtype)) return false;
  const rule = LINE_ENDPOINT_RULES[lineSubtype];
  if (!rule) return false;
  const allowed = endpointKind === 'start' ? rule.start : rule.finish;
  return allowed.has('node');
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

/** Snap to existing object or plan auto-creation of a connection node. */
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
  if (lineEndpointAllowsNode(lineSubtype, endpointKind)) {
    return { ok: true, lon: point[0], lat: point[1], createNode: true };
  }
  const hint = nearest
    ? `Ближайший: ${nearest.object.name}, ${nearest.distanceKm.toFixed(2)} км.`
    : 'Нет подходящих объектов в проекте.';
  return {
    ok: false,
    message: `Точка «${endpointKind === 'start' ? 'начала' : 'конца'}» не привязана (допуск ${tol} км). ${hint}`,
  };
}

