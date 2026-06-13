/** Display-only line endpoint attach to earthwork footprint edges (footprints map mode). */

import { LINE_SUBTYPES } from './api';
import type { InfraObject } from './api';
import { isEarthworkEligibleSubtype } from './infraPadEarthwork';
import { findLineEndpointAttachment } from './lineEndpointRules';
import { closestPointOnSegment } from './lineSplit';
import { metersPerDegree, resolveFootprintLonLat } from './padFootprintGeo';

export const LINE_FOOTPRINT_ATTACH_KEY = 'line_footprint_attach';
/** Per line subtype: edge attach on earthwork point footprint. */
export const FOOTPRINT_LINE_CONNECTIONS_KEY = 'footprint_line_connections';

export type FootprintEdgeAttach = {
  edge_index: number;
  t?: number;
};

/** @deprecated Legacy line-side attach; prefer point `footprint_line_connections`. */
export type LineFootprintEndpointAttach = FootprintEdgeAttach & {
  point_id: string;
};

export type LineFootprintAttach = {
  start?: LineFootprintEndpointAttach;
  finish?: LineFootprintEndpointAttach;
};

export type PointFootprintLineConnections = Partial<Record<string, FootprintEdgeAttach>>;

export type FootprintEdgeInfo = {
  edgeIndex: number;
  label: string;
};

export type FootprintCardinalDirection = 'north' | 'south' | 'east' | 'west';

const CARDINAL_LABEL_PREFIX: Record<FootprintCardinalDirection, string> = {
  north: 'Север',
  south: 'Юг',
  east: 'Восток',
  west: 'Запад',
};

/** Cardinal side of a rectangular footprint ring (labels depend on pad rotation). */
export function findFootprintEdgeByCardinal(
  ring: [number, number][],
  direction: FootprintCardinalDirection,
): FootprintEdgeInfo | null {
  const prefix = CARDINAL_LABEL_PREFIX[direction];
  return footprintRingEdges(ring).find((e) => e.label.startsWith(prefix)) ?? null;
}

/** Reverse lookup: edge index → cardinal (rectangular rings only). */
export function cardinalDirectionFromEdgeIndex(
  ring: [number, number][],
  edgeIndex: number,
): FootprintCardinalDirection | null {
  const edge = footprintRingEdges(ring).find((e) => e.edgeIndex === edgeIndex);
  if (!edge) return null;
  for (const opt of FOOTPRINT_CARDINAL_OPTIONS) {
    if (edge.label.startsWith(opt.label)) return opt.value;
  }
  return null;
}

export function footprintAttachCardinalSelectValue(
  ring: [number, number][],
  attach: FootprintEdgeAttach | undefined,
): '' | '__center__' | FootprintCardinalDirection {
  if (attach == null) return '__center__';
  const cardinal = cardinalDirectionFromEdgeIndex(ring, attach.edge_index);
  return cardinal ?? '';
}

export function footprintAttachFromCardinalSelect(
  ring: [number, number][],
  value: '' | '__center__' | FootprintCardinalDirection,
  t = DEFAULT_T,
): FootprintEdgeAttach | null {
  if (value === '' || value === '__center__') return null;
  const edge = findFootprintEdgeByCardinal(ring, value);
  if (!edge) return null;
  const clamped = Math.max(0, Math.min(1, t));
  return { edge_index: edge.edgeIndex, t: clamped };
}

export type FootprintCardinalAttachTemplate = {
  cardinal: FootprintCardinalDirection;
  t?: number;
};

/** Parameters tab template: line subtype → cardinal side or null (center). */
export type FootprintLineConnectionTemplate = Partial<
  Record<string, FootprintCardinalAttachTemplate | null>
>;

export function connectionsFromCardinalTemplate(
  ring: [number, number][],
  template: FootprintLineConnectionTemplate,
): PointFootprintLineConnections {
  const out: PointFootprintLineConnections = {};
  for (const st of LINE_SUBTYPES) {
    if (!(st in template)) continue;
    const entry = template[st];
    if (entry == null) continue;
    const edge = findFootprintEdgeByCardinal(ring, entry.cardinal);
    if (!edge) continue;
    const t =
      entry.t != null && Number.isFinite(entry.t)
        ? Math.max(0, Math.min(1, entry.t))
        : DEFAULT_T;
    out[st] = { edge_index: edge.edgeIndex, t };
  }
  return out;
}

export function applyFootprintTemplateToObject(
  obj: InfraObject,
  template: FootprintLineConnectionTemplate,
  mode: 'merge' | 'replace' = 'merge',
): PointFootprintLineConnections | null {
  const ring = resolveFootprintLonLat(obj);
  if (!ring) return null;
  const resolved = connectionsFromCardinalTemplate(ring, template);

  if (mode === 'replace') {
    return resolved;
  }

  const current = readPointFootprintLineConnections(obj.properties);
  const next = { ...current };
  for (const st of LINE_SUBTYPES) {
    if (!(st in template)) continue;
    if (template[st] == null) delete next[st];
    else if (resolved[st]) next[st] = resolved[st];
  }
  return next;
}

export function earthworkFootprintConnectionTargets(
  objects: InfraObject[],
  pointSubtypeFilter?: string,
): InfraObject[] {
  return objects.filter(
    (o) =>
      isEarthworkEligibleSubtype(o.subtype) &&
      resolveFootprintLonLat(o) != null &&
      (!pointSubtypeFilter || o.subtype === pointSubtypeFilter),
  );
}

export const FOOTPRINT_CARDINAL_OPTIONS: { value: FootprintCardinalDirection; label: string }[] = [
  { value: 'north', label: 'Север' },
  { value: 'south', label: 'Юг' },
  { value: 'east', label: 'Восток' },
  { value: 'west', label: 'Запад' },
];

const DEFAULT_T = 0.5;
/** ~50 m hit tolerance for edge pick on map. */
export const FOOTPRINT_EDGE_HIT_TOLERANCE_KM = 0.05;

const LINE_SUBTYPE_SET = new Set<string>(LINE_SUBTYPES as readonly string[]);

function parseEdgeAttach(raw: unknown): FootprintEdgeAttach | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const edgeIndex = Number(o.edge_index);
  if (!Number.isInteger(edgeIndex) || edgeIndex < 0) return null;
  let t: number | undefined;
  if (o.t != null && o.t !== '') {
    const n = Number(o.t);
    if (Number.isFinite(n)) t = Math.max(0, Math.min(1, n));
  }
  return { edge_index: edgeIndex, ...(t != null ? { t } : {}) };
}

function parseEndpoint(raw: unknown): LineFootprintEndpointAttach | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const pointId = typeof o.point_id === 'string' ? o.point_id.trim() : '';
  const edge = parseEdgeAttach(raw);
  if (!pointId || !edge) return null;
  return { point_id: pointId, ...edge };
}

export function readPointFootprintLineConnections(
  props: Record<string, unknown> | null | undefined,
): PointFootprintLineConnections {
  const raw = props?.[FOOTPRINT_LINE_CONNECTIONS_KEY];
  if (!raw || typeof raw !== 'object') return {};
  const out: PointFootprintLineConnections = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!LINE_SUBTYPE_SET.has(key)) continue;
    const edge = parseEdgeAttach(value);
    if (edge) out[key] = edge;
  }
  return out;
}

export function writePointFootprintLineConnections(
  props: Record<string, unknown>,
  connections: PointFootprintLineConnections | null,
): Record<string, unknown> {
  const next = { ...props };
  if (!connections || Object.keys(connections).length === 0) {
    delete next[FOOTPRINT_LINE_CONNECTIONS_KEY];
    return next;
  }
  const payload: Record<string, FootprintEdgeAttach> = {};
  for (const st of LINE_SUBTYPES) {
    const edge = connections[st];
    if (edge) payload[st] = edge;
  }
  if (Object.keys(payload).length === 0) {
    delete next[FOOTPRINT_LINE_CONNECTIONS_KEY];
  } else {
    next[FOOTPRINT_LINE_CONNECTIONS_KEY] = payload;
  }
  return next;
}

export function mergePointFootprintLineConnection(
  props: Record<string, unknown>,
  lineSubtype: string,
  value: FootprintEdgeAttach | null,
): Record<string, unknown> {
  if (!LINE_SUBTYPE_SET.has(lineSubtype)) return props;
  const current = readPointFootprintLineConnections(props);
  const next = { ...current };
  if (value) next[lineSubtype] = value;
  else delete next[lineSubtype];
  return writePointFootprintLineConnections(props, Object.keys(next).length ? next : null);
}

export function pointFootprintLineConnectionsEqual(
  a: PointFootprintLineConnections,
  b: PointFootprintLineConnections,
): boolean {
  for (const st of LINE_SUBTYPES) {
    const x = a[st];
    const y = b[st];
    if (!x && !y) continue;
    if (!x || !y) return false;
    const tx = x.t ?? DEFAULT_T;
    const ty = y.t ?? DEFAULT_T;
    if (x.edge_index !== y.edge_index || Math.abs(tx - ty) >= 1e-6) return false;
  }
  return true;
}

function validateEdgeOnPoint(
  point: InfraObject,
  edge: FootprintEdgeAttach,
): FootprintEdgeAttach | null {
  const ring = resolveFootprintLonLat(point);
  if (!ring) return null;
  const edgeCount = ring.length >= 2 ? ring.length - 1 : 0;
  if (edge.edge_index < 0 || edge.edge_index >= edgeCount) return null;
  return edge;
}

export function readLineFootprintAttach(
  props: Record<string, unknown> | null | undefined,
): LineFootprintAttach {
  const raw = props?.[LINE_FOOTPRINT_ATTACH_KEY];
  if (!raw || typeof raw !== 'object') return {};
  const o = raw as Record<string, unknown>;
  const start = parseEndpoint(o.start);
  const finish = parseEndpoint(o.finish);
  return {
    ...(start ? { start } : {}),
    ...(finish ? { finish } : {}),
  };
}

export function writeLineFootprintAttach(
  props: Record<string, unknown>,
  attach: LineFootprintAttach | null,
): Record<string, unknown> {
  const next = { ...props };
  if (!attach || (!attach.start && !attach.finish)) {
    delete next[LINE_FOOTPRINT_ATTACH_KEY];
    return next;
  }
  const payload: Record<string, unknown> = {};
  if (attach.start) payload.start = attach.start;
  if (attach.finish) payload.finish = attach.finish;
  next[LINE_FOOTPRINT_ATTACH_KEY] = payload;
  return next;
}

export function mergeLineFootprintEndpointAttach(
  props: Record<string, unknown>,
  endpoint: 'start' | 'finish',
  value: LineFootprintEndpointAttach | null,
): Record<string, unknown> {
  const current = readLineFootprintAttach(props);
  const next: LineFootprintAttach = { ...current };
  if (value) next[endpoint] = value;
  else delete next[endpoint];
  return writeLineFootprintAttach(props, Object.keys(next).length ? next : null);
}

function ringEdges(ring: [number, number][]): { a: [number, number]; b: [number, number]; index: number }[] {
  const edges: { a: [number, number]; b: [number, number]; index: number }[] = [];
  for (let i = 0; i < ring.length - 1; i++) {
    edges.push({ a: ring[i]!, b: ring[i + 1]!, index: i });
  }
  return edges;
}

function edgeOutwardAzimuthDeg(a: [number, number], b: [number, number]): number {
  const midLat = (a[1] + b[1]) / 2;
  const { lon: mPerDegLon, lat: mPerDegLat } = metersPerDegree(midLat);
  const de = (b[0] - a[0]) * mPerDegLon;
  const dn = (b[1] - a[1]) * mPerDegLat;
  // CCW ring: outward normal in ENU is (dn, -de) → azimuth from north.
  const rad = Math.atan2(dn, -de);
  let deg = (rad * 180) / Math.PI;
  if (deg < 0) deg += 360;
  return deg;
}

function cardinalLabel(azimuthDeg: number): string {
  const dirs = [
    { label: 'Север', min: 315, max: 360 },
    { label: 'Север', min: 0, max: 45 },
    { label: 'Восток', min: 45, max: 135 },
    { label: 'Юг', min: 135, max: 225 },
    { label: 'Запад', min: 225, max: 315 },
  ];
  for (const d of dirs) {
    if (azimuthDeg >= d.min && azimuthDeg < d.max) return d.label;
  }
  return 'Север';
}

/** Edge list for UI select (1-based «Ребро N» or cardinal for 4-corner rects). */
export function footprintRingEdges(
  ring: [number, number][],
  options?: { useCardinalForRect?: boolean },
): FootprintEdgeInfo[] {
  const edges = ringEdges(ring);
  const useCardinal =
    options?.useCardinalForRect !== false && edges.length === 4 && ring.length >= 5;
  return edges.map(({ a, b, index }) => ({
    edgeIndex: index,
    label: useCardinal
      ? `${cardinalLabel(edgeOutwardAzimuthDeg(a, b))} (${index + 1})`
      : `Ребро ${index + 1}`,
  }));
}

export function lonLatOnFootprintEdge(
  ring: [number, number][],
  edgeIndex: number,
  t = DEFAULT_T,
): [number, number] | null {
  const edges = ringEdges(ring);
  const edge = edges.find((e) => e.index === edgeIndex);
  if (!edge) return null;
  const clamped = Math.max(0, Math.min(1, t));
  return [
    edge.a[0] + (edge.b[0] - edge.a[0]) * clamped,
    edge.a[1] + (edge.b[1] - edge.a[1]) * clamped,
  ];
}

export function nearestFootprintEdge(
  ring: [number, number][],
  click: [number, number],
): { edgeIndex: number; t: number; lon: number; lat: number; distanceKm: number } | null {
  const edges = ringEdges(ring);
  let best: {
    edgeIndex: number;
    t: number;
    lon: number;
    lat: number;
    distanceKm: number;
  } | null = null;
  for (const { a, b, index } of edges) {
    const hit = closestPointOnSegment(click, a, b, index);
    if (!best || hit.distanceKm < best.distanceKm) {
      best = {
        edgeIndex: index,
        t: hit.t,
        lon: hit.point[0],
        lat: hit.point[1],
        distanceKm: hit.distanceKm,
      };
    }
  }
  return best;
}

export function nearestFootprintEdgeForObject(
  obj: InfraObject,
  click: [number, number],
  maxDistanceKm = FOOTPRINT_EDGE_HIT_TOLERANCE_KM,
): { edgeIndex: number; t: number; lon: number; lat: number; distanceKm: number } | null {
  const ring = resolveFootprintLonLat(obj);
  if (!ring) return null;
  const hit = nearestFootprintEdge(ring, click);
  if (!hit || hit.distanceKm > maxDistanceKm) return null;
  return hit;
}

export function nearestFootprintEdgeAmongObjects(
  click: [number, number],
  infraObjects: InfraObject[],
  maxDistanceKm = FOOTPRINT_EDGE_HIT_TOLERANCE_KM,
): { point: InfraObject; edgeIndex: number; t: number; lon: number; lat: number } | null {
  let best: {
    point: InfraObject;
    edgeIndex: number;
    t: number;
    lon: number;
    lat: number;
    distanceKm: number;
  } | null = null;
  for (const obj of infraObjects) {
    if (!isEarthworkEligibleSubtype(obj.subtype)) continue;
    const hit = nearestFootprintEdgeForObject(obj, click, maxDistanceKm);
    if (!hit) continue;
    if (!best || hit.distanceKm < best.distanceKm) {
      best = { point: obj, ...hit };
    }
  }
  if (!best) return null;
  return {
    point: best.point,
    edgeIndex: best.edgeIndex,
    t: best.t,
    lon: best.lon,
    lat: best.lat,
  };
}

function resolveEndpointPoint(
  endpoint: 'start' | 'finish',
  line: InfraObject,
  attach: LineFootprintEndpointAttach,
  snapPool: InfraObject[],
): InfraObject | null {
  const point = snapPool.find((o) => o.id === attach.point_id);
  if (!point || !isEarthworkEligibleSubtype(point.subtype)) return null;
  const pathCoord = endpoint === 'start' ? [line.lon, line.lat] : [line.end_lon, line.end_lat];
  if (pathCoord[0] == null || pathCoord[1] == null) return null;
  const attachment = findLineEndpointAttachment(
    line.subtype,
    endpoint,
    [pathCoord[0], pathCoord[1]],
    snapPool,
  );
  if (!attachment || attachment.object.id !== point.id) return null;
  return point;
}

export function resolveValidFootprintEndpointAttach(
  endpoint: 'start' | 'finish',
  line: InfraObject,
  attach: LineFootprintEndpointAttach | undefined,
  snapPool: InfraObject[],
): { point: InfraObject; edgeIndex: number; t: number } | null {
  if (!attach) return null;
  const point = resolveEndpointPoint(endpoint, line, attach, snapPool);
  if (!point) return null;
  const validated = validateEdgeOnPoint(point, attach);
  if (!validated) return null;
  return { point, edgeIndex: validated.edge_index, t: validated.t ?? DEFAULT_T };
}

function resolveDisplayAttachForEndpoint(
  endpoint: 'start' | 'finish',
  line: InfraObject,
  snapPool: InfraObject[],
): { point: InfraObject; edgeIndex: number; t: number } | null {
  const pathCoord =
    endpoint === 'start' ? [line.lon, line.lat] : [line.end_lon, line.end_lat];
  if (pathCoord[0] == null || pathCoord[1] == null) return null;
  const attachment = findLineEndpointAttachment(
    line.subtype,
    endpoint,
    [pathCoord[0], pathCoord[1]],
    snapPool,
  );
  if (!attachment || !isEarthworkEligibleSubtype(attachment.object.subtype)) return null;
  const point = attachment.object;

  const conn = readPointFootprintLineConnections(point.properties)[line.subtype];
  if (conn) {
    const validated = validateEdgeOnPoint(point, conn);
    if (validated) {
      return { point, edgeIndex: validated.edge_index, t: validated.t ?? DEFAULT_T };
    }
  }

  const legacy = readLineFootprintAttach(line.properties);
  const legacyEp = endpoint === 'start' ? legacy.start : legacy.finish;
  if (legacyEp && legacyEp.point_id === point.id) {
    return resolveValidFootprintEndpointAttach(endpoint, line, legacyEp, snapPool);
  }
  return null;
}

export function applyFootprintDisplayEndpoints(
  path: [number, number][],
  line: InfraObject,
  snapPool: InfraObject[],
): [number, number][] {
  if (path.length < 2) return path;
  const out = path.map((p) => [p[0], p[1]] as [number, number]);

  const start = resolveDisplayAttachForEndpoint('start', line, snapPool);
  if (start) {
    const ring = resolveFootprintLonLat(start.point)!;
    const pt = lonLatOnFootprintEdge(ring, start.edgeIndex, start.t);
    if (pt) out[0] = pt;
  }

  const finish = resolveDisplayAttachForEndpoint('finish', line, snapPool);
  if (finish) {
    const ring = resolveFootprintLonLat(finish.point)!;
    const pt = lonLatOnFootprintEdge(ring, finish.edgeIndex, finish.t);
    if (pt) out[out.length - 1] = pt;
  }

  return out;
}

export function lineFootprintAttachEqual(a: LineFootprintAttach, b: LineFootprintAttach): boolean {
  const eqEndpoint = (
    x?: LineFootprintEndpointAttach,
    y?: LineFootprintEndpointAttach,
  ): boolean => {
    if (!x && !y) return true;
    if (!x || !y) return false;
    const tx = x.t ?? DEFAULT_T;
    const ty = y.t ?? DEFAULT_T;
    return x.point_id === y.point_id && x.edge_index === y.edge_index && Math.abs(tx - ty) < 1e-6;
  };
  return eqEndpoint(a.start, b.start) && eqEndpoint(a.finish, b.finish);
}
