import type { InfraObject } from './api';
import { getLineCoordinates, isLineSubtype } from './infraGeometry';
import type { InfraPointSnapIndex } from './infraSnapIndex';

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

/** Nearest point infrastructure object (any subtype, same rules as backend). */
function nearestPointObject(
  point: [number, number],
  infraObjects: InfraObject[],
  snapIndex?: InfraPointSnapIndex,
): { object: InfraObject; distanceKm: number } | null {
  if (snapIndex) {
    return snapIndex.nearest(point, LINE_ENDPOINT_SNAP_TOLERANCE_KM * 4);
  }
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
  lineSubtype: string,
  _endpointKind: 'start' | 'finish',
  point: [number, number],
  infraObjects: InfraObject[],
  snapIndex?: InfraPointSnapIndex,
): [number, number] {
  if (!isLineSubtype(lineSubtype)) return point;
  const nearest = nearestPointObject(point, infraObjects, snapIndex);
  if (!nearest || nearest.distanceKm > LINE_ENDPOINT_SNAP_TOLERANCE_KM) return point;
  return [nearest.object.lon, nearest.object.lat];
}

/** @deprecated Prefer nearestPointLineEndpoint; kept for existing imports. */
export function nearestAllowedLineEndpoint(
  lineSubtype: string,
  _endpointKind: 'start' | 'finish',
  point: [number, number],
  infraObjects: InfraObject[],
  snapIndex?: InfraPointSnapIndex,
): { object: InfraObject; distanceKm: number } | null {
  if (!isLineSubtype(lineSubtype)) return null;
  return nearestPointObject(point, infraObjects, snapIndex);
}

export function nearestPointLineEndpoint(
  lineSubtype: string,
  _endpointKind: 'start' | 'finish',
  point: [number, number],
  infraObjects: InfraObject[],
  snapIndex?: InfraPointSnapIndex,
): { object: InfraObject; distanceKm: number } | null {
  return nearestAllowedLineEndpoint(lineSubtype, _endpointKind, point, infraObjects, snapIndex);
}

/** Snap while drawing: cursor over icon, or within tolerance to nearest point object. */
export function snapLineDrawPoint(
  lineSubtype: string,
  cursor: [number, number],
  infraObjects: InfraObject[],
  overPoint?: { lon: number; lat: number } | null,
  endpointKind: 'start' | 'finish' = 'finish',
  snapIndex?: InfraPointSnapIndex,
): [number, number] {
  if (overPoint) return [overPoint.lon, overPoint.lat];
  return snapLineEndpoint(lineSubtype, endpointKind, cursor, infraObjects, snapIndex);
}

export function isLineEndpointSnapped(
  lineSubtype: string,
  endpointKind: 'start' | 'finish',
  point: [number, number],
  infraObjects: InfraObject[],
): boolean {
  const nearest = nearestPointLineEndpoint(lineSubtype, endpointKind, point, infraObjects);
  return nearest != null && nearest.distanceKm <= LINE_ENDPOINT_SNAP_TOLERANCE_KM;
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

/** Snap to existing point object or plan auto-creation of a connection node. */
export function resolveLineEndpoint(
  lineSubtype: string,
  endpointKind: 'start' | 'finish',
  point: [number, number],
  infraObjects: InfraObject[],
): ResolvedLineEndpoint {
  const nearest = nearestPointLineEndpoint(lineSubtype, endpointKind, point, infraObjects);
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
  if (isLineSubtype(lineSubtype)) {
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

/** Force start/finish vertices to attached point object coordinates (storage + 3D). */
export function normalizeLinePathEndpoints(
  lineSubtype: string,
  path: [number, number][],
  infraObjects: InfraObject[],
  snapIndex?: InfraPointSnapIndex,
): [number, number][] {
  if (path.length < 2) return path;
  const out = path.map((p) => [p[0], p[1]] as [number, number]);
  const start = findLineEndpointAttachment(lineSubtype, 'start', out[0]!, infraObjects, snapIndex);
  const finish = findLineEndpointAttachment(
    lineSubtype,
    'finish',
    out[out.length - 1]!,
    infraObjects,
    snapIndex,
  );
  if (start) out[0] = [start.lon, start.lat];
  if (finish) out[out.length - 1] = [finish.lon, finish.lat];
  return out;
}

export type LineEndpointAttachment = {
  object: InfraObject;
  lon: number;
  lat: number;
};

/** Point object under cursor for line endpoint snap (edit / move). */
export function attachmentForPointObject(object: InfraObject): LineEndpointAttachment | null {
  if (isLineSubtype(object.subtype)) return null;
  return { object, lon: object.lon, lat: object.lat };
}

export function findLineEndpointAttachment(
  lineSubtype: string,
  endpointKind: 'start' | 'finish',
  point: [number, number],
  infraObjects: InfraObject[],
  snapIndex?: InfraPointSnapIndex,
): LineEndpointAttachment | null {
  const nearest = nearestPointLineEndpoint(lineSubtype, endpointKind, point, infraObjects, snapIndex);
  if (!nearest || nearest.distanceKm > LINE_ENDPOINT_SNAP_TOLERANCE_KM) return null;
  return { object: nearest.object, lon: nearest.object.lon, lat: nearest.object.lat };
}

function endpointMoved(a: [number, number], b: [number, number]): boolean {
  return Math.abs(a[0] - b[0]) > 1e-6 || Math.abs(a[1] - b[1]) > 1e-6;
}

export function lineEndpointAttachmentsFromObject(
  line: InfraObject,
  infraObjects: InfraObject[],
  snapPool?: InfraObject[],
): {
  start: [number, number];
  finish: [number, number];
  startAttach: LineEndpointAttachment | null;
  finishAttach: LineEndpointAttachment | null;
} | null {
  const pool = snapPool ?? infraObjects;
  const path =
    normalizeLinePathEndpoints(
      line.subtype,
      (getLineCoordinates(line) ?? []).map((c) => [c[0], c[1]] as [number, number]),
      pool,
    ) ?? getLineCoordinates(line);
  if (!path || path.length < 2) return null;
  const start = path[0] as [number, number];
  const finish = path[path.length - 1] as [number, number];
  return {
    start,
    finish,
    startAttach: findLineEndpointAttachment(line.subtype, 'start', start, pool),
    finishAttach: findLineEndpointAttachment(line.subtype, 'finish', finish, pool),
  };
}

/**
 * When moving a line endpoint: snap to a nearby point object or revert to the original attachment.
 * Endpoints cannot remain disconnected ("in the air").
 */
export function constrainLineCoordinatesOnEdit(params: {
  lineSubtype: string;
  originalStart: [number, number];
  originalFinish: [number, number];
  originalStartAttach: LineEndpointAttachment | null;
  originalFinishAttach: LineEndpointAttachment | null;
  draftCoords: number[][];
  infraObjects: InfraObject[];
  /** Point object under cursor when the endpoint was released. */
  cursorTargetStart?: InfraObject | null;
  cursorTargetFinish?: InfraObject | null;
}): {
  coords: number[][];
  revertedStart: boolean;
  revertedFinish: boolean;
  reconnectedStart: boolean;
  reconnectedFinish: boolean;
} {
  const result = params.draftCoords.map(([lo, la]) => [lo, la] as [number, number]);
  if (result.length < 2) {
    return {
      coords: result,
      revertedStart: false,
      revertedFinish: false,
      reconnectedStart: false,
      reconnectedFinish: false,
    };
  }

  const applyEndpoint = (
    index: number,
    originalAttach: LineEndpointAttachment | null,
    originalPoint: [number, number],
    cursorTarget?: InfraObject | null,
  ): { reverted: boolean; reconnected: boolean } => {
    const draft = result[index]!;
    if (!endpointMoved(draft, originalPoint)) {
      return { reverted: false, reconnected: false };
    }

    const fromCursor = cursorTarget ? attachmentForPointObject(cursorTarget) : null;
    if (fromCursor) {
      result[index] = [fromCursor.lon, fromCursor.lat];
      const reconnected = !originalAttach || originalAttach.object.id !== fromCursor.object.id;
      return { reverted: false, reconnected };
    }

    const nearest = findLineEndpointAttachment(
      params.lineSubtype,
      index === 0 ? 'start' : 'finish',
      result[index]!,
      params.infraObjects,
    );
    if (nearest) {
      result[index] = [nearest.lon, nearest.lat];
      const reconnected = !originalAttach || originalAttach.object.id !== nearest.object.id;
      return { reverted: false, reconnected };
    }

    if (originalAttach) {
      result[index] = [originalAttach.lon, originalAttach.lat];
      return { reverted: true, reconnected: false };
    }
    result[index] = [...originalPoint];
    return { reverted: true, reconnected: false };
  };

  const start = applyEndpoint(
    0,
    params.originalStartAttach,
    params.originalStart,
    params.cursorTargetStart,
  );
  const finish = applyEndpoint(
    result.length - 1,
    params.originalFinishAttach,
    params.originalFinish,
    params.cursorTargetFinish,
  );

  return {
    coords: result,
    revertedStart: start.reverted,
    revertedFinish: finish.reverted,
    reconnectedStart: start.reconnected,
    reconnectedFinish: finish.reconnected,
  };
}
