import { LINE_SUBTYPES, type InfraObject } from './api';

export function isLineSubtype(subtype: string): boolean {
  return (LINE_SUBTYPES as readonly string[]).includes(subtype);
}

/** Full vertex list for a linear infrastructure object. */
export function getLineCoordinates(obj: InfraObject): number[][] | null {
  if (obj.coordinates && obj.coordinates.length >= 2) {
    return obj.coordinates.map((c) => [c[0], c[1]]);
  }
  if (obj.end_lon != null && obj.end_lat != null) {
    return [
      [obj.lon, obj.lat],
      [obj.end_lon, obj.end_lat],
    ];
  }
  return null;
}
