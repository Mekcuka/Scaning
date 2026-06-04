import type { InfraObject } from './api';
import { coordsEqualOrRounded } from './coordEqual';
import { getLineCoordinates, isLineSubtype } from './infraGeometry';

export type LineEndpointAttachment = {
  object: InfraObject;
  lon: number;
  lat: number;
};

function pointObjectAtCoord(
  point: [number, number],
  infraObjects: InfraObject[],
): InfraObject | null {
  for (const obj of infraObjects) {
    if (isLineSubtype(obj.subtype)) continue;
    if (coordsEqualOrRounded(point[0], point[1], obj.lon, obj.lat)) {
      return obj;
    }
  }
  return null;
}

export function snapLineEndpoint(
  lineSubtype: string,
  _endpointKind: 'start' | 'finish',
  point: [number, number],
  infraObjects: InfraObject[],
): [number, number] {
  if (!isLineSubtype(lineSubtype)) return point;
  const obj = pointObjectAtCoord(point, infraObjects);
  if (!obj) return point;
  return [obj.lon, obj.lat];
}

/** @deprecated Prefer pointObjectAtCoord; kept for existing imports. */
export function nearestAllowedLineEndpoint(
  lineSubtype: string,
  _endpointKind: 'start' | 'finish',
  point: [number, number],
  infraObjects: InfraObject[],
): { object: InfraObject; distanceKm: number } | null {
  if (!isLineSubtype(lineSubtype)) return null;
  const obj = pointObjectAtCoord(point, infraObjects);
  if (!obj) return null;
  return { object: obj, distanceKm: 0 };
}

export function nearestPointLineEndpoint(
  lineSubtype: string,
  endpointKind: 'start' | 'finish',
  point: [number, number],
  infraObjects: InfraObject[],
): { object: InfraObject; distanceKm: number } | null {
  return nearestAllowedLineEndpoint(lineSubtype, endpointKind, point, infraObjects);
}

/** Snap while drawing: only when cursor is over a point icon (overPoint). */
export function snapLineDrawPoint(
  lineSubtype: string,
  cursor: [number, number],
  infraObjects: InfraObject[],
  overPoint?: { lon: number; lat: number; id?: string } | null,
  endpointKind: 'start' | 'finish' = 'finish',
): [number, number] {
  if (overPoint?.id) {
    const obj = infraObjects.find((o) => o.id === overPoint.id);
    if (obj && !isLineSubtype(obj.subtype)) {
      return [obj.lon, obj.lat];
    }
    return [overPoint.lon, overPoint.lat];
  }
  if (overPoint) {
    return [overPoint.lon, overPoint.lat];
  }
  if (endpointKind === 'finish') {
    const obj = pointObjectAtCoord(cursor, infraObjects);
    if (obj) return [obj.lon, obj.lat];
  }
  return cursor;
}

export function isLineEndpointSnapped(
  lineSubtype: string,
  _endpointKind: 'start' | 'finish',
  point: [number, number],
  infraObjects: InfraObject[],
): boolean {
  if (!isLineSubtype(lineSubtype)) return false;
  return pointObjectAtCoord(point, infraObjects) != null;
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

/** Snap to existing point object (exact coords) or plan auto-creation of a connection node. */
export function resolveLineEndpoint(
  lineSubtype: string,
  endpointKind: 'start' | 'finish',
  point: [number, number],
  infraObjects: InfraObject[],
): ResolvedLineEndpoint {
  const attached = pointObjectAtCoord(point, infraObjects);
  if (attached) {
    return {
      ok: true,
      lon: attached.lon,
      lat: attached.lat,
      attachedTo: attached,
      createNode: false,
    };
  }
  if (endpointKind === 'start' || !isLineSubtype(lineSubtype)) {
    return {
      ok: false,
      message:
        endpointKind === 'start'
          ? 'Начало линии — клик по точечному объекту на карте.'
          : 'Конец линии не совпадает с координатами точечного объекта.',
    };
  }
  return { ok: true, lon: point[0], lat: point[1], createNode: true };
}

/** Force start/finish vertices to attached point object coordinates (storage + 3D). */
export function normalizeLinePathEndpoints(
  lineSubtype: string,
  path: [number, number][],
  infraObjects: InfraObject[],
): [number, number][] {
  if (path.length < 2) return path;
  const out = path.map((p) => [p[0], p[1]] as [number, number]);
  const start = findLineEndpointAttachment(lineSubtype, 'start', out[0]!, infraObjects);
  const finish = findLineEndpointAttachment(
    lineSubtype,
    'finish',
    out[out.length - 1]!,
    infraObjects,
  );
  if (start) out[0] = [start.lon, start.lat];
  if (finish) out[out.length - 1] = [finish.lon, finish.lat];
  return out;
}

/** Point object under cursor for line endpoint snap (edit / move). */
export function attachmentForPointObject(object: InfraObject): LineEndpointAttachment | null {
  if (isLineSubtype(object.subtype)) return null;
  return { object, lon: object.lon, lat: object.lat };
}

export function findLineEndpointAttachment(
  lineSubtype: string,
  _endpointKind: 'start' | 'finish',
  point: [number, number],
  infraObjects: InfraObject[],
): LineEndpointAttachment | null {
  if (!isLineSubtype(lineSubtype)) return null;
  const obj = pointObjectAtCoord(point, infraObjects);
  if (!obj) return null;
  return { object: obj, lon: obj.lon, lat: obj.lat };
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
  const raw = getLineCoordinates(line);
  if (!raw || raw.length < 2) return null;
  const path = raw.map((c) => [c[0], c[1]] as [number, number]);
  const start = path[0]!;
  const finish = path[path.length - 1]!;
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
