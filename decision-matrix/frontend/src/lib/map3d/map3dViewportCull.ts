import type { Map as MapLibreMap } from 'maplibre-gl';

/** Smaller margin when zoomed in; wider prefetch when zoomed out. */
export function viewportMarginDegForZoom(zoom: number): number {
  if (zoom >= 14) return 0.01;
  if (zoom >= 10) return 0.03;
  if (zoom >= 7) return 0.05;
  return 0.08;
}

export function viewportMarginDegForMap(map: MapLibreMap): number {
  return viewportMarginDegForZoom(map.getZoom());
}

export function isLonLatInExpandedBounds(
  map: MapLibreMap,
  lon: number,
  lat: number,
  marginDeg?: number,
): boolean {
  const margin = marginDeg ?? viewportMarginDegForMap(map);
  const bounds = map.getBounds();
  const west = bounds.getWest() - margin;
  const east = bounds.getEast() + margin;
  const south = bounds.getSouth() - margin;
  const north = bounds.getNorth() + margin;
  if (lon < west || lon > east || lat < south || lat > north) return false;
  return true;
}
