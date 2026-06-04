import { linkCoordMatch } from './infraLinks';

/** ~1 mm at equator in degrees — matches backend coord_equal.py */
export const COORD_EQUAL_ABS_TOL = 1e-8;

export function coordsEqual(
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number,
): boolean {
  return (
    Math.abs(lon1 - lon2) <= COORD_EQUAL_ABS_TOL &&
    Math.abs(lat1 - lat2) <= COORD_EQUAL_ABS_TOL
  );
}

/** Exact match or same rounded display (legacy lines saved with 3-decimal ends). */
export function coordsEqualOrRounded(
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number,
): boolean {
  return (
    coordsEqual(lon1, lat1, lon2, lat2) ||
    (linkCoordMatch(lon1, lon2) && linkCoordMatch(lat1, lat2))
  );
}
