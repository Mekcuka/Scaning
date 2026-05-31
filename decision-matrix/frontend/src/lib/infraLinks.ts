import { LINE_SUBTYPES, type InfraObject } from './api';
import { roundCoord } from './coords';

const MOVE_MATCH_EPS = 1e-6;

function sameCoord(a: number, b: number): boolean {
  return Math.abs(a - b) <= MOVE_MATCH_EPS;
}

/** Exact match or same rounded display (legacy lines saved with 3-decimal ends). */
function linkCoordMatch(a: number, b: number): boolean {
  return sameCoord(a, b) || roundCoord(a) === roundCoord(b);
}

function lineCoordsOrEndpoints(obj: InfraObject): [number, number][] | null {
  if (obj.coordinates && obj.coordinates.length >= 2) {
    return obj.coordinates.map(([lon, lat]) => [lon, lat]);
  }
  if (obj.end_lon != null && obj.end_lat != null) {
    return [
      [obj.lon, obj.lat],
      [obj.end_lon, obj.end_lat],
    ];
  }
  return null;
}

function isLineSubtype(subtype: string): boolean {
  return LINE_SUBTYPES.includes(subtype as (typeof LINE_SUBTYPES)[number]);
}

export function linkedLineIdsForPoint(pointObj: InfraObject, allInfra: InfraObject[]): string[] {
  if (isLineSubtype(pointObj.subtype)) return [];
  const pointLon = pointObj.lon;
  const pointLat = pointObj.lat;
  const ids: string[] = [];
  for (const obj of allInfra) {
    if (!isLineSubtype(obj.subtype)) continue;
    const coords = lineCoordsOrEndpoints(obj);
    if (!coords || coords.length < 2) continue;
    const first = coords[0]!;
    const last = coords[coords.length - 1]!;
    const startMatches =
      linkCoordMatch(first[0], pointLon) && linkCoordMatch(first[1], pointLat);
    const finishMatches =
      linkCoordMatch(last[0], pointLon) && linkCoordMatch(last[1], pointLat);
    if (startMatches || finishMatches) ids.push(obj.id);
  }
  return ids;
}

/** IDs to drop from client cache (selected points + their attached lines). */
export function expandInfraDeleteIds(ids: Iterable<string>, allInfra: InfraObject[]): Set<string> {
  const deleteIds = new Set(ids);
  for (const id of deleteIds) {
    const obj = allInfra.find((o) => o.id === id);
    if (!obj || isLineSubtype(obj.subtype)) continue;
    for (const lineId of linkedLineIdsForPoint(obj, allInfra)) deleteIds.add(lineId);
  }
  return deleteIds;
}

/**
 * Backend cascades line removal when deleting a point — avoid parallel DELETE on the same lines (404).
 */
export function infraDeleteApiIds(deleteIds: Iterable<string>, allInfra: InfraObject[]): string[] {
  const idSet = new Set(deleteIds);
  const pointIds = new Set<string>();
  const lineIds = new Set<string>();
  for (const id of idSet) {
    const obj = allInfra.find((o) => o.id === id);
    if (!obj) {
      pointIds.add(id);
      continue;
    }
    if (isLineSubtype(obj.subtype)) lineIds.add(id);
    else pointIds.add(id);
  }
  const cascadedLineIds = new Set<string>();
  for (const pid of pointIds) {
    const p = allInfra.find((o) => o.id === pid);
    if (p && !isLineSubtype(p.subtype)) {
      for (const lid of linkedLineIdsForPoint(p, allInfra)) cascadedLineIds.add(lid);
    }
  }
  const apiIds = new Set<string>();
  for (const lid of lineIds) {
    if (!cascadedLineIds.has(lid)) apiIds.add(lid);
  }
  for (const pid of pointIds) apiIds.add(pid);
  return [...apiIds];
}

