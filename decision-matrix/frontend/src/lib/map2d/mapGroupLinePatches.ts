import { LINE_SUBTYPES, type InfraObject, type InfraObjectCreate } from '../api';
import { linkCoordMatch, lineCoordsOrEndpoints } from '../infraLinks';
import {
  constrainLineCoordinatesOnEdit,
  lineEndpointAttachmentsFromObject,
  normalizeLinePathEndpoints,
} from '../lineEndpointRules';

export type MovedPosition = { lon: number; lat: number };

export type MovedPointUpdate = {
  id: string;
  oldLon: number;
  oldLat: number;
  newLon: number;
  newLat: number;
};

export type LineGeometryBefore = {
  lon: number;
  lat: number;
  end_lon?: number | null;
  end_lat?: number | null;
  coordinates?: number[][] | null;
};

export type LineEndpointPatchAcc = {
  before: LineGeometryBefore;
  replaceStart?: [number, number];
  replaceEnd?: [number, number];
};

export type LinePatchResult = {
  lineId: string;
  payload: Partial<InfraObjectCreate>;
  before: LineGeometryBefore;
};

function isLineSubtype(subtype: string): boolean {
  return LINE_SUBTYPES.includes(subtype as (typeof LINE_SUBTYPES)[number]);
}

function lineGeometryBefore(line: InfraObject): LineGeometryBefore {
  return {
    lon: line.lon,
    lat: line.lat,
    end_lon: line.end_lon,
    end_lat: line.end_lat,
    coordinates: line.coordinates,
  };
}

function lineFromBefore(lineId: string, subtype: string, before: LineGeometryBefore): InfraObject {
  return {
    id: lineId,
    layer_id: '',
    name: '',
    subtype,
    category: 'line',
    lon: before.lon,
    lat: before.lat,
    end_lon: before.end_lon ?? null,
    end_lat: before.end_lat ?? null,
    coordinates: before.coordinates ?? null,
    properties: {},
  } as InfraObject;
}

/** Apply one moved point's endpoint replacements onto an accumulator (from original line geometry). */
function applyPointMoveToAccumulator(
  acc: LineEndpointPatchAcc,
  lineSubtype: string,
  oldLon: number,
  oldLat: number,
  newLon: number,
  newLat: number,
): void {
  const line = lineFromBefore('', lineSubtype, acc.before);
  const lineCoords = lineCoordsOrEndpoints(line);
  if (!lineCoords || lineCoords.length < 2) return;
  const first = lineCoords[0]!;
  const last = lineCoords[lineCoords.length - 1]!;
  const firstMatches =
    linkCoordMatch(first[0], oldLon) && linkCoordMatch(first[1], oldLat);
  const lastMatches =
    linkCoordMatch(last[0], oldLon) && linkCoordMatch(last[1], oldLat);
  if (firstMatches) acc.replaceStart = [newLon, newLat];
  if (lastMatches) acc.replaceEnd = [newLon, newLat];
}

/**
 * For lines not in the group selection: merge endpoint updates when multiple moved points
 * share the same line.
 */
export function accumulateLineEndpointPatches(
  allInfra: InfraObject[],
  movedPoints: MovedPointUpdate[],
  excludeLineIds: Set<string>,
): Map<string, LineEndpointPatchAcc> {
  const map = new Map<string, LineEndpointPatchAcc>();

  for (const { id, oldLon, oldLat, newLon, newLat } of movedPoints) {
    const pointBefore = allInfra.find((o) => o.id === id);
    if (!pointBefore || isLineSubtype(pointBefore.subtype)) continue;

    for (const line of allInfra) {
      if (line.id === id || excludeLineIds.has(line.id)) continue;
      if (!isLineSubtype(line.subtype)) continue;

      let acc = map.get(line.id);
      if (!acc) {
        acc = { before: lineGeometryBefore(line) };
        map.set(line.id, acc);
      }
      applyPointMoveToAccumulator(acc, line.subtype, oldLon, oldLat, newLon, newLat);
    }
  }

  return map;
}

/** Build API payload from original line geometry + accumulated endpoint replacements. */
export function finalizeLinePayloadFromEndpoints(acc: LineEndpointPatchAcc): Partial<InfraObjectCreate> {
  const line = lineFromBefore('', 'autoroad', acc.before);
  const lineCoords = lineCoordsOrEndpoints(line);
  if (!lineCoords || lineCoords.length < 2) {
    return {
      lon: acc.before.lon,
      lat: acc.before.lat,
      end_lon: acc.before.end_lon ?? undefined,
      end_lat: acc.before.end_lat ?? undefined,
      coordinates: acc.before.coordinates ?? undefined,
    };
  }

  const shifted = lineCoords.map(([lo, la], i) => {
    if (i === 0 && acc.replaceStart) return acc.replaceStart;
    if (i === lineCoords.length - 1 && acc.replaceEnd) return acc.replaceEnd;
    return [lo, la] as [number, number];
  });

  return {
    lon: shifted[0]![0],
    lat: shifted[0]![1],
    end_lon: shifted[shifted.length - 1]![0],
    end_lat: shifted[shifted.length - 1]![1],
    coordinates: shifted,
  };
}

export function lineEndpointPatchesToResults(map: Map<string, LineEndpointPatchAcc>): LinePatchResult[] {
  const results: LinePatchResult[] = [];
  for (const [lineId, acc] of map) {
    const payload = finalizeLinePayloadFromEndpoints(acc);
    if (!acc.replaceStart && !acc.replaceEnd) continue;
    results.push({ lineId, payload, before: acc.before });
  }
  return results;
}

function infraPoolWithMovedPositions(
  allInfra: InfraObject[],
  movedPositions: Map<string, MovedPosition>,
): InfraObject[] {
  return allInfra.map((o) => {
    const m = movedPositions.get(o.id);
    if (!m || isLineSubtype(o.subtype)) return o;
    return { ...o, lon: m.lon, lat: m.lat };
  });
}

function pointObjectAtMovedPosition(
  object: InfraObject,
  movedPositions: Map<string, MovedPosition>,
): InfraObject | null {
  const m = movedPositions.get(object.id);
  if (!m) return null;
  return { ...object, lon: m.lon, lat: m.lat };
}

/**
 * Constrain a line moved as part of a group (Translate) so endpoints stay on anchors.
 * Moved anchor points snap to their new coordinates; unmoved anchors stay on supports.
 */
export function constrainGroupMovedLine(
  lineBefore: InfraObject,
  draftCoords: number[][],
  movedPositions: Map<string, MovedPosition>,
  allInfra: InfraObject[],
): [number, number][] {
  let roundedCoords = draftCoords.map(([lo, la]) => [lo, la] as [number, number]);
  const pool = infraPoolWithMovedPositions(
    allInfra.filter((o) => o.id !== lineBefore.id),
    movedPositions,
  );

  const endpoints = lineEndpointAttachmentsFromObject(lineBefore, pool);
  if (endpoints) {
    const cursorTargetStart = endpoints.startAttach
      ? pointObjectAtMovedPosition(endpoints.startAttach.object, movedPositions)
      : null;
    const cursorTargetFinish = endpoints.finishAttach
      ? pointObjectAtMovedPosition(endpoints.finishAttach.object, movedPositions)
      : null;

    const constrained = constrainLineCoordinatesOnEdit({
      lineSubtype: lineBefore.subtype,
      originalStart: endpoints.start,
      originalFinish: endpoints.finish,
      originalStartAttach: endpoints.startAttach,
      originalFinishAttach: endpoints.finishAttach,
      draftCoords: roundedCoords,
      infraObjects: pool,
      cursorTargetStart: cursorTargetStart ?? undefined,
      cursorTargetFinish: cursorTargetFinish ?? undefined,
    });
    roundedCoords = constrained.coords.map(([lo, la]) => [lo, la] as [number, number]);
    roundedCoords = normalizeLinePathEndpoints(lineBefore.subtype, roundedCoords, pool);
  }

  return roundedCoords;
}

export function buildMovedPositionsMap(
  entries: Iterable<{ id: string; lon: number; lat: number }>,
): Map<string, MovedPosition> {
  const map = new Map<string, MovedPosition>();
  for (const { id, lon, lat } of entries) {
    map.set(id, { lon, lat });
  }
  return map;
}
