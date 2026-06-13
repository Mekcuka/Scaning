import type { InfraObject } from './api';

const BOTTOMHOLE_PICK_SUBTYPES = new Set([
  'well_bottomhole_nnb',
  'well_bottomhole_gs_heel',
]);

export function isPadPlacementBottomhole(obj: InfraObject): boolean {
  return BOTTOMHOLE_PICK_SUBTYPES.has(obj.subtype);
}

export function mergeBottomholeIds(current: string[], id: string): string[] {
  if (current.includes(id)) return current.filter((x) => x !== id);
  return [...current, id];
}

export function infraObjectInBbox(
  obj: InfraObject,
  bbox: [number, number, number, number],
): boolean {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const lon = obj.longitude;
  const lat = obj.latitude;
  if (lon == null || lat == null) return false;
  return lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat;
}
