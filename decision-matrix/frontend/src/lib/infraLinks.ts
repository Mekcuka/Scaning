import { LINE_SUBTYPES, type InfraObject } from './api';
import { roundCoord } from './coords';

const MOVE_MATCH_EPS = 1e-6;

function sameCoord(a: number, b: number): boolean {
  return Math.abs(a - b) <= MOVE_MATCH_EPS;
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
  const pointLon = roundCoord(pointObj.lon);
  const pointLat = roundCoord(pointObj.lat);
  const ids: string[] = [];
  for (const obj of allInfra) {
    if (!isLineSubtype(obj.subtype)) continue;
    const coords = lineCoordsOrEndpoints(obj);
    if (!coords || coords.length < 2) continue;
    const first = coords[0]!;
    const last = coords[coords.length - 1]!;
    const startMatches =
      sameCoord(roundCoord(first[0]), pointLon) && sameCoord(roundCoord(first[1]), pointLat);
    const finishMatches =
      sameCoord(roundCoord(last[0]), pointLon) && sameCoord(roundCoord(last[1]), pointLat);
    if (startMatches || finishMatches) ids.push(obj.id);
  }
  return ids;
}

